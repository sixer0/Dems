# DEMS Edge Client Demo

## Overview (added 2026-11-06, branch `audit/fix-20261105`, decision D268)

This block describes the repository as it stands on branch `audit/fix-20261105`. The sections after it (from **Ringkasan** on) are the history of the demo and of the earlier tasks, kept as they were written; dated corrections inside them mark what has changed since.

### What DEMS is

DEMS is a Digital Evidence Management System for interview-room recording. A Core server on the interview-room host records up to four cameras with their paired microphones, seals each recording into a signed evidence package, keeps an audit trail and serves the operators. The parts are:

- the **Core server**, which holds the recording truth, the database, the roles and the device pairing;
- the **web console**, used by operators and administrators;
- the **LCD front panel**, a small service that drives the ESP32 status panel from the Core's state;
- the **capture worker**, a C program the Core starts to record cameras and microphones;
- the **tablet app**, the operator's Android app, paired with one Core;
- the **shared contract**, the types, operations, words and rules that the Core and both clients share.

### Repository layout

| Folder | What it holds |
|---|---|
| `apps/core-server` | Core server: Fastify on port 4420, PostgreSQL storage (Drizzle migrations), roles and permissions, device pairing, capture supervision, sealing, export, CLI tools for keys and operator passwords |
| `apps/core-web` | Web console: React + Vite (Dashboard, Session Monitor, Start Session, Evidence, Devices & Inputs, Paired Devices, Security & Audit, System & Maintenance) |
| `apps/lcd-backend` | LCD front panel service: Python HTTP service on port 8090 that writes to the ESP32 panel over USB serial (see its `README.md`) |
| `apps/capture-worker` | Capture worker, capture relay and guard: C programs against FFmpeg 9.0.2, built with `make` (see its `README.md`) |
| `apps/mobile` | Tablet app: Expo / React Native Android app `com.dems.demo.tablet` |
| `apps/mock-core` | Mock Core of the first demo: health check and WebSocket heartbeat on `127.0.0.1:4400`, used by the Simulated mode only |
| `apps/transcriber` | Speech-to-text pipeline called by the Core server |
| `packages/shared` | Shared contract: API client and constants, operations, i18n words, simulator, theme tokens, OpenAPI generator |
| `packages/capture-protocol` | The message contract between the Core server and the capture worker (protocol number 6) |
| `scripts/` | Project-local PostgreSQL scripts (`scripts/pg`), test runners (`scripts/test`), host helpers (`scripts/host`), capture setup and release packaging |
| `deploy/` | Docker installer sources and package records |
| `docs/` | Task records of the earlier tasks (identification, research, plans, implementation and test reports), one folder per task |

### Requirements

| Item | Version or setting | Notes |
|---|---|---|
| Node | 26.8.2 for development (`.node-version`; root `engines` `>=26.8.2 <27`) | The bench host runs the Core with its own Node 26.12.1 under `/opt/dems` |
| npm | 11.19.1 (`packageManager`) | Workspaces; `.npmrc` sets `save-exact=true` |
| FFmpeg | 9.0.2, installed at `/opt/dems/ffmpeg-9.0.2` on the bench host | The capture worker builds and links against it: `PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig` |
| C toolchain | a C compiler, `make`, `pkg-config` | For `apps/capture-worker` |
| PostgreSQL | 18, port **4432** | Development: the project-local cluster from the npm package `embedded-postgres` (`npm run pg:*`, data in the git-ignored `.data/`). Bench host: the system cluster `postgresql@18-main` on port 4432, database `dems_demo` |
| Python | 3, with `pyserial` 3.5 | For `apps/lcd-backend` |
| Tablet toolchain | Expo `~57.0.26`, React Native 0.86.3, JDK 17, Android SDK (platform 36, build-tools 36.0.0, NDK 27.1.12297006), the Gradle wrapper that `expo prebuild` writes | Section **Prerequisites** below lists how the development Mac was set up |

### Running in development

All commands run from the repository root unless a folder is named. Every command below is a script of the root `package.json` or of a workspace `package.json`.

```sh
npm install                           # also applies the mobile library patch (postinstall)
npm run typecheck                     # every workspace: tsc -b in core-web, tsc --noEmit elsewhere
npm run lint                          # oxlint in the TypeScript workspaces, eslint in apps/mobile
npm test                              # unit tests of every workspace: vitest, and jest in apps/mobile
```

- One workspace at a time: `npm test -w @dems/core-server` (the Core's `unit` Vitest project), `npm test -w @dems/core-web`, `npm test -w @dems/shared`, `npm test -w @dems/mobile` (jest), `npm run typecheck -w @dems/core-web` (`tsc -b`). The audit's gates also ran `npx tsc -b` inside `packages/shared`, `apps/core-server` and `apps/core-web`, and `npx tsc --noEmit -p .` inside `apps/mobile` (`docs/2026-11-05_team_update_audit/test/17_dbw4_report.md` section 1; see **Changes in audit/fix-20261105** for where that folder is kept).
- Core server and console for development: `npm run pg:init` (once), `npm run pg:start`, `npm run db:create`, `npm run db:migrate`, `npm run db:seed`, `npm run dev:server` (or `npm run start:server`), then `npm run dev:web`. The section **Live mode** below has the full sequence and the variables the console needs.
- Tablet in development: `npm run dev:mobile` (Metro), `npm run build:android` (debug APK), `npm run mobile:reverse` (adb reverse of ports 4400, 8081 and 4420).
- Capture worker: `npm run test:capture-worker` (`make -C apps/capture-worker`: static rules, self-test, unit checks, build). The end-to-end series is `npm run test:capture-worker-e2e` (about 35 minutes).
- Everything in one run: `npm run test:regression` (section **Tests** below).

**Database tests and their isolation rule.** `npm run test:db` runs the Core's `db` Vitest project. Its global setup (`apps/core-server/test/global-setup.db.ts`) attaches to PostgreSQL on `127.0.0.1:4432`, fails (never skips) when nothing answers there, creates throw-away databases for the run and drops them at the end. The rule follows from that:

- Run DB tests only against the project-local cluster (`npm run pg:start`), never against a database that holds real data.
- On the bench host, port 4432 belongs to the production cluster. DB tests therefore never run there while production is up. They run only inside a **DB test window** (section **Production on the bench host**), which stops production and starts the project cluster in its place (decision D32).
- The scripts that touch the database or the host take lock files under `.locks/` (`heavy-host.lock`, `db-migrate.lock`), so only one heavy run and one migration writer run at a time.
- On the bench host a loopback firewall rule (unit `dems-loopback-rule.service`) lets only the Core's own service user push to the capture ingest ports 8554-8564. Tests that start pushers as a normal user are refused there, so the gated end-to-end capture tests cannot pass on that host (decisions D150, D153).

### Production on the bench host

The bench host runs DEMS from `/opt/dems/core`, a copy of the repository tree at a deployed commit. It is not a git checkout; the audit worked in a separate git worktree and copied files into `/opt/dems/core` (section **Deploy procedure**).

| systemd unit | Port | What it runs |
|---|---|---|
| `dems-core` | 4420 (health: `/api/v1/health`) | The Core server, as its own service user, from `/opt/dems/core/apps/core-server`. It starts after `postgresql@18-main` and requires `dems-loopback-rule.service` |
| `dems-console` | 5173 | The web console (Vite server) |
| `dems-lcd` | 8090 (status: `/api/dems/status`) | The LCD front panel service |
| `postgresql@18-main` | 4432 | PostgreSQL 18, database `dems_demo` |

- **REAL_PRODUCTION.** The bench Core runs in the real production mode: real cameras, microphones, the capture worker and the production signing key, with no simulated values (anything without a real data source shows "Not reported", decision D25). Its settings come from the units' environment files, which are not part of the repository; this README gives no value from them.
- **Boot proof.** At each start the Core runs its composition, fence, registry, host and program checks and then logs exactly one line with the code `CAPTURE_BOOT_CHECKS_PASSED`, `"operation":"REAL_PRODUCTION"`, `"checks":"real"` and the worker version (`capture-worker/0.8.0` since the W3 deploy). A worker whose build stamp, version or protocol does not match is refused at boot (`STAMP_STALE`, `VERSION_MISMATCH`, `PROTOCOL_MISMATCH` lines). A start without the `CAPTURE_BOOT_CHECKS_PASSED` line is not a healthy production start.
- **Capture worker on the host.** The worker binary and its stamp file are installed together (binary 0755, stamp 0644, both root-owned). The Core checks that the stamp names this binary's sha256 and the source it was built from.
- **Known service behaviour.** Stopping `dems-console` leaves it `failed` with status 143 (the Vite server's exit on SIGTERM); it starts cleanly. A console restart ends the web sign-ins, and a Core restart ends every sign-in (decisions D115, D246).

### Deploy procedure (short)

The audit deployed each fix wave as one lockstep copy of the changed files of one commit (records: `implementation/162_w3_deploy.md` and `implementation/w4_deploy.md` of the audit task folder).

1. **Preconditions.** The worktree is clean at the commit to deploy. No session is recording, no seal is pending and no capture process is running. List the changed paths with `git diff --name-status --no-renames <deployed commit> <new commit>`. Check that every modified path in `/opt/dems/core` has the sha256 of the deployed commit's copy, and that every added path is absent.
2. **Worker build, only when `apps/capture-worker` changed.** One fresh build of the committed tree in `apps/capture-worker`: `make clean`, then `PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig make check selftest unit build/capture-worker relay-check` under the heavy-host lock. Check that the stamp names the worker version, the protocol, the source hash and the binary hash.
3. **Migration dry run, only when a migration is in the diff.** Restore a fresh dump into a scratch database, apply the migration there with the project's own migration code (under the migration lock, as the owner role), compare probes before and after, then drop the scratch database.
4. **Backup.** Copy every file that will be replaced (and the worker pair) with `cp -a --parents` into `/opt/dems-backup-<wave>-<timestamp>/`, with a `SHA256SUMS` manifest, the list of added paths and the owners before. When a migration runs, also take a `pg_dump -Fc` of `dems_demo` into `/var/backups/dems/` (root, mode 0600).
5. **Install.** Stop `dems-core` and `dems-console` (and `dems-lcd` when its files change; PostgreSQL stays up). Install each file from `git show <commit>:<path>` with `install -o <owner> -g <group> -m 0644` to a `.<name>.new` file, `chmod g-w,o-w`, then `mv -f` over the old file. Check that every installed file has the sha256 of the commit's copy. Apply the migration if there is one. Start the units.
6. **Smoke.** All units active with no restarts; one `CAPTURE_BOOT_CHECKS_PASSED` with `REAL_PRODUCTION` and the expected worker version; no stamp, version or protocol refusal; no log line at level 50 or 60; HTTP 200 from `4420/api/v1/health`, `5173` and `8090/api/dems/status`; the migration ledger as expected.
7. **Rollback** (not needed so far). Stop the units, copy the files back from the backup and check them against its `SHA256SUMS`, delete the added paths, restore the dump only if a migration ran (never delete a migration file while the ledger lists it), start the units, smoke again.

**DB test window** (decision D32; records `test/16_dbw3d_report.md` and `test/17_dbw4_report.md`). Production is down for about 70 to 100 seconds:

1. Check that no session is recording and no seal is pending.
2. Take a fresh `pg_dump -Fc` of `dems_demo` into `/var/backups/dems/`.
3. Stop `dems-core`, `dems-console`, `dems-lcd` and `postgresql@18-main`. Port 4432 is now free.
4. `npm run pg:start` (the project cluster from the worktree's `.data/`).
5. `npm run test:db -w @dems/core-server -- <listed test files> --maxWorkers=2`.
6. `npm run pg:stop`.
7. Start `postgresql@18-main` and the three DEMS units.
8. Smoke: health 200, console and LCD 200, one `CAPTURE_BOOT_CHECKS_PASSED` with `REAL_PRODUCTION`, ledger unchanged. Pin the smoke to the worker version now deployed (`capture-worker/0.8.0`; an older pin gave a false red in DBW4). Restore the dump only if the smoke fails.

### Bench host configuration

The systemd units and the nftables rule of the bench host, and a template of the Core's environment file (`core.env.example`, built from the code), are in [`deploy/bench-config/`](deploy/bench-config/README.md) (decisions D274, D275). The real `/etc/dems/core.env` is never published: its README gives the full deploy-time configuration guide (environment file, PostgreSQL roles and connection files, migrations, unit install, boot verification). Share a filled `core.env` only privately, over SSH between team machines.

### Tablet app

**Debug and release builds.**

| | Debug APK | Release APK |
|---|---|---|
| Build | `npm run build:android` (`expo prebuild --platform android --no-install`, then `./gradlew assembleDebug` in `apps/mobile/android`). The audit ran the Gradle step as `./gradlew --no-daemon assembleDebug -PreactNativeArchitectures=arm64-v8a` | `apps/mobile/scripts/create-demo-keystore.sh` once, then `apps/mobile/scripts/build-release-apk.sh` |
| Output | `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` | `release/android/DEMS-Demo-0.1.0.apk` with `.sha256`, `SHA256SUMS.txt` and `BUILD-INFO.txt` (git-ignored) |
| Signed with | the Android debug key | the DEMO release keystore in the git-ignored `apps/mobile/signing/` (marked "DEMO ONLY - NOT FOR PRODUCTION"); no password is printed |
| JavaScript | from Metro in development (`npm run dev:mobile`) | compiled Hermes bundle inside the APK |
| Sources | Live, plus the older Simulated and Heartbeat sources for development links and tests | **Live only** (decision D163); biometric sign-in is off (residual R174-G5) |

- `build-release-apk.sh` checks the signing material and the `app.json` plugin, runs `npx expo prebuild --platform android --no-install` and `./gradlew --no-daemon assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64` under `.locks/gradle.lock`, then copies the APK and writes its checksums. It never runs `prebuild --clean` and never installs anything. Run it outside the agent sandbox. It is written for the development Mac (default `JAVA_HOME` and `ANDROID_HOME` paths, `/usr/bin/lockf`).
- Back up the debug APK before a release build; prebuild has cleared `android/` once even without `--clean`.
- The two builds have different signatures. Installing one over the other needs an uninstall first, which deletes the tablet's pairing.

**Core server address (decision D263).** The Pair screen has a **Core server address** card with Host and Port fields. The default is `127.0.0.1:4420`, which reaches the Core through `adb reverse` (`npm run mobile:reverse`) on an emulator or a USB-connected device. For a real tablet on the interview-room LAN, enter the Core host's LAN address (for example `192.168.x.x`) and port `4420`, tap **Use this address**, then pair. The card shows the address in force ("In use"), and Pair stays disabled while the fields hold another address. Settings shows the address read-only, and the login screen's offline message names it.

- Accepted: an IPv4 address in a private, loopback or link-local range, or a host name; port 1 to 65535. Refused, each with its own message: a public IPv4 address, a scheme or a path, `host:port` in the Host field, IPv6.
- Changing the address first forgets the stored device credential, any owed sign-out and the stored Core snapshot. A different Core means a new pairing.
- A real-device test of the release APK against a LAN Core has not been run yet (row 238 proves the configuration only).

**Pairing.** In the web console, an operator with the pairing permission (Supervisor) opens **Admin > Paired Devices** (`/admin/devices`) and issues a one-time six-digit code. On the tablet, check the Core server address, enter the code on the Pair screen and tap Pair. The tablet then appears in Paired Devices (`DEV-000N`), where it can also be revoked. No pairing code is written in this README; each code is issued fresh in the console.

**Cleartext to the Core (decision D263, residual R263-TLS).** The app talks to the Core over plain `http` and `ws`. Android's network security configuration cannot allow cleartext by address range, so the app's configuration (generated by `apps/mobile/plugins/with-dems-core-cleartext.js`) permits cleartext in its base configuration, in release builds too, and keeps the loopback entries. The compensations are: the app refuses public IPv4 addresses, the device credential is bound to the address, and the interview-room LAN is a closed network. Traffic between tablet and Core is not encrypted. TLS to the Core is the proper fix and is open as residual **R263-TLS**.

### Camera and microphone pairs (decision D5)

- Each camera is paired with one microphone: VIDEO-01 with MIC-01, VIDEO-02 with MIC-02, VIDEO-03 with MIC-03, VIDEO-04 with MIC-04. The pairs are set in the capture setup; an operator cannot move a microphone to another camera during a session (operation 81 answers `409 AUDIO_SOURCE_FIXED_BY_PAIRING`), and a microphone change in the selector is a swap, so no camera is left without its pair.
- **Audio per pair.** The capture worker opens one encoder per microphone and writes its audio twice: into its paired camera's file (VIDEO-0N) and into its own audio file (`MIC-0N.m4a`, stored as track AUDIO-0N). The seal declares every audio track (evidence package version /2.1) and the verifier checks them. MIC-01 also feeds the transcription.
- **"Paired mic missing".** A camera in the recording plan whose paired microphone is not assigned (`NOT_ASSIGNED`) or could not be opened (`NOT_OPENED`). The recording still starts, so an interview is never lost because one microphone failed: that camera's file gets a silent audio track, there is no AUDIO-0N file for that pair, and the manifest records the missing channel. The Core logs `CAPTURE_PAIRED_MIC_MISSING` at warn level and raises a `PAIRED_MIC_MISSING` warning notice for the operators, with an extra sentence for Pair 1 because MIC-01 feeds the transcription; the tablet shows it on Devices, in the bell and as a toast. An unassigned microphone slot is normally blocked at pre-check, so at start the usual case is a microphone that did not open.

### Changes in audit/fix-20261105 (2026-11-05/06)

The decision log (decisions D1 to D268) and every row report are kept with the audit's task documents in `docs/2026-11-05_team_update_audit/` of the controller's working copy. That folder is **not part of this repository**; this README cites its file names and decision numbers for reference.

**Mission 1: audit and fix of the team's updates (fix waves W1 to W3, all deployed and re-judged; closed by D158).**

- W1: on a REAL_PRODUCTION Core, anything without a real data source shows "Not reported" and the production login offers no Simulated mode (D25); the capture worker names its version and writes a build stamp that the Core checks at boot (`capture-worker/0.7.0` at that point); a 12-item pre-check; audit vocabulary and allow-lists; camera link sensing with a link-up sweep; fault-cleared events; identity, login lock and banner words; credential scope; operator purge safety; migrations 0042 (constraint repair, so production equals a fresh install, D22) and 0043 (operator purge scope).
- W2: camera preview contract and status, preview gating on the web tiles and Start Session, registered device lists, security commands and their administration pages; device commands that would only be simulated on a real Core are refused instead of audited as "(simulated)" (D89).
- W3: the D5 camera and microphone pairs from contract to evidence: pairing contract, capture protocol 6 with `capture-worker/0.8.0`, migration 0044 (AUDIO-01..04 fragments), per-pair audio in the worker, the operator's audio switch retired (operation 81), sealing and export of the audio tracks with the shared verifier, and the web selector, monitor, Start Session and Evidence pages.

**Fix wave W4 (deployed 2026-11-06 as `8962f16b`, D246).**

- Web Dashboard, Session Monitor and Start Session thumbnails use the reach-gated live preview and close it when the tab is hidden; the monitor re-checks a camera that has been unreachable for a while.
- Web Devices: the camera search "View device" route, PoE switch and recording lamp no longer counted on a self-capture Core, one microphone status reader for every list.
- LCD camera lamp lit only for a reachable camera or an open stream (fix in the Core's LCD bridge).
- Microphone levels routed by microphone id (channels 3 and 4 were dropped before); microphone reach taken from the idle meter.
- Comment corrections in the shared package.

**Mission 3: the tablet app adapted to the new Core (run before Mission 2, D148).**

- Release builds carry the Live source only; the login and settings follow Live (D163).
- Four camera previews with their pairs, the paired-mic notice, the swap selector, the retired operation 81, the Core identity on login and pairing, device commands, verify reader and integrity view with audio tracks, pair words on Home and microphone cards.
- Sign-out gaps closed (owed sign-out kept and paid on link-up), stale texts and highlights fixed in a second cycle.
- The Core server address setting on the Pair screen and the cleartext configuration (D263 to D266, commit `f41972f9`).
- Debug APK built from `cf59429e` and release APK from `f41972f9`; neither is a production build (DEMO signing).

### Known open items

| Item | What is open |
|---|---|
| R225-F1, F2, F3 | A tablet is silently unpaired by a database rollback (`pg_restore`) taken before it paired, by moving it to another Core, or by a reset of the pairing tables. Open fixes: F1, a deploy runbook step that lists tablets paired after the dump before any restoring rollback; F2, a unique Core id per installation (Cores do not have one yet); F3, the tablet compares the stored Core id before sending its credential (depends on F2; the address setting of D263 covers the "another Core" case in part) |
| R263-TLS | Tablet to Core traffic is cleartext `http`/`ws` on the LAN; TLS is the proper fix (the user's decision) |
| R174-G5 | Biometric sign-in is off in release builds; enabling it needs Keystore-bound authentication proven on a real tablet |
| R224-1 | If the secure write of an owed sign-out fails, the debt is forgotten after a cold start (it is logged) |
| R224-2 | Unpairing does not delete a stored owed sign-out; it clears at the next socket that is not an operator's |
| U-18 | A web view that may keep a recovered session on screen: not reproduced, parked with a capture plan for the next real failed start (D242) |
| 4+4 acceptance recording | The first real session with four cameras and four microphones, after the camera cable returns, is a mandatory acceptance test before operational use (D153); the gated end-to-end D5 tests cannot run on the bench host |
| Mission 2 | The end-to-end UI judging panel (web, LCD and the adapted tablet) is postponed by the user |

### Branches

- `task4/input-av-core-port` is the team's branch.
- `audit/fix-20261105` is this audit's branch: the fix waves W1 to W4 and Mission 3, on top of the team's state at the audit's start.
- The two branches are **not merged**. Do not merge or rebase one onto the other without a decision; open a pull request between them when that decision is made.

## Ringkasan (Bahasa Indonesia)

Repositori ini berisi **demo** DEMS Edge Client: konsol web Core, aplikasi operator Android (ponsel dan tablet), dan mock Core lokal. **Semua data sintetis (DEMO)**: tidak ada data, kunci, atau kredensial asli.

- **Presenter:** pakai paket siap jalan di `release/` (tidak perlu Node atau Android SDK). Ikuti `release/RUN-ON-ANOTHER-PC.md` (web) dan `release/android/INSTALL-ANDROID.md` (APK, pasang lewat ADB).
- **Login demo:** `budi.santoso`, `andi.pratama` atau `rina.wijaya`, kata sandi `demo-2026`. Tombol kunci keamanan masuk sebagai Supervisor. Kode pairing `482913`. PIN emulator `1234`.
- **Developer:** buka web selalu di `http://127.0.0.1:5173` (jangan `localhost`). Nyalakan emulator dari Terminal Anda sendiri dengan jendela terlihat, dan jaga Mac tetap menyala selama build atau agen berjalan.
- **Mode Live (sejak 2026-10-06):** konsol web dan aplikasi memakai satu Core server (`127.0.0.1:4420`) dengan PostgreSQL lokal (`127.0.0.1:4432`). Urutannya: `npm run pg:init` (sekali), `npm run pg:start`, buat/migrasi/seed database `dems_demo`, `npm run start:server`, lalu konsol dengan `DEMS_CORE_PROXY_PORT=4420 VITE_DEMS_CORE_MODE=live npm run dev:web` dan buka `http://127.0.0.1:5173` (jangan `localhost`). Perintah lengkap ada di bagian **Live mode**. Akun yang di-seed memakai kredensial demo yang dipublikasikan untuk akun sintetis pada demo lokal; mode Live hanya untuk loopback (`127.0.0.1`).
- **Koreksi emulator (sejak 2026-10-04):** emulator yang dipakai sekarang `dems2_phone`, `dems2_tablet` dan `dems2_phone2`. PIN emulator di atas hanya berlaku untuk AVD lama `dems_*` (tidak dinyalakan lagi). Kunci layar `dems2_phone` dan `dems2_tablet` dipasang sendiri oleh pengguna dengan `apps/mobile/scripts/emulator-user-lock.sh`; nilainya tidak ditulis di sini, dan agen tidak pernah mengetik PIN.
- **Tugas keempat (ditambahkan 2026-10-14; cabang `task4/input-av-core-port`, belum masuk `main`):** kunci tanda tangan produksi (`npm run evidence:production-key -w @dems/core-server`), penggantian kata sandi demo dari host (`npm run operator:set-password -w @dems/core-server`), kamera ONVIF nyata dan fungsi komisioning (Linux saja). Semuanya diuji hanya di Mac ini dengan perangkat pengganti; belum ada sesi dengan kamera produksi yang direkam dan disegel, dan belum ada yang dijalankan di host Ubuntu. Rinciannya di bagian **Task 4** dan Known limits 46 sampai 58.

## LCD ESP32 integration (2026-10-19)

The optional local `backend-lcd` service is in [`apps/lcd-backend`](apps/lcd-backend/README.md).
Set `DEMS_LCD_BACKEND_URL=http://127.0.0.1:8090` on the Core host and restart Core to publish video-track recording status to it. Inspect **Devices & Inputs → Front Panel → LCD connection** in Live mode. Default is disabled; the in-app Simulated preview never contacts USB. Core uses a six-second recording lease. The Python HTTP integration is tested without USB; the physical ESP32 panel is not yet verified. Installation, serial device settings, channel mapping and Linux Docker bench limits are in that README.

The Linux Docker installer can include LCD directly: see [Docker installer instructions](deploy/docker/installer/INSTALL-ID.md). The bundle carries the LCD runtime and configures the Core connection and USB group during installation; a separate LCD installation is unnecessary.

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
The fourth task (branch `task4/input-av-core-port`, not on `main`; added 2026-10-14) adds a production signing key, the host command that replaces the published demo password, real ONVIF cameras and the commissioning functions of a Linux host: block **Task 4** of that section. It is tested on this Mac with test doubles only.

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
| "Use security key (simulated)" button | Simulated data mode only: signs in as the Supervisor (`andi.pratama`). In Live data mode (a console connected to a Core server, both lanes) the Login has no such button — the Core has no security-key sign-in; use the user name and password |
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
- **Library source patch (since 2026-10-12, decision D247).** The Android app is built with a patched `react-native-reanimated` 4.5.1: on React Native 0.86 the library logged an exception with a stack of about 190 frames on the UI thread for every animated view that no longer existed, on every event inside a draw pass, which froze a long-lived app during a recording. The patch (`apps/mobile/patches/react-native-reanimated+4.5.1.patch`, one Kotlin file) skips a view tag without a mounted view. `npm install` applies it through the root `postinstall` script (`apps/mobile/scripts/apply-patches.sh`: the system `patch` tool, no dependency; it refuses any other library version). After an install with `--ignore-scripts` run `npm run patches:apply -w @dems/mobile`. The Gradle build fails (`demsCheckLibraryPatches`) when the library is not patched, and the installed APK must be rebuilt for the patch to take effect. Why, what, and how to drop it when the library is upgraded: `apps/mobile/patches/README.md`.
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

Correction (2026-11-06, branch `audit/fix-20261105`): a release APK built on this branch carries the Live source only (decision D163) and reaches the Core at the address set on its Pair screen; see **Tablet app** in the Overview. The sentence above describes the 0.1.0 packages of the first demo.

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

- A reset keeps the paired devices, device credentials, sessions, settings, pairing codes and the lineage of the discarded audit chain. Everything else returns to the seed. (Added 2026-10-14, branch `task4/input-av-core-port`, integration pass I-9c: it also keeps the capture devices, their credentials, the capture and STT configuration and the media store root, and the five tables of the fourth task - the stream rows of each camera, the registered sound-card inputs, the camera network settings, the temporary-address rows of the address helper and the installation acceptances; 18 kept tables, `apps/core-server/src/db/reset/kept-tables.ts`. Tested on throw-away databases only.) A lane database that does not exist yet is created by its first reset.

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

**5. Pair the app and use it in Live mode.** This needs the debug APK (`npm run build:android`; the release APK is Simulated-only) on a booted emulator, and the Core server running. (Correction 2026-11-06: on branch `audit/fix-20261105` the release APK is Live-only, D163; see **Tablet app** in the Overview.)

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

Added by the third task (`docs/2026-10-07_dems_real_capture_sealing/`); this section describes the tree at commit `713d83f` (2026-10-11): its body was written at commit `f293221` and is corrected by the three blocks **Fix waves H and I**, **Fix wave K** and **Fix waves L and M** below, which are part of it. A Core server can now record: a capture worker (`apps/capture-worker`) writes one file per camera with the session audio in it, the Core seals the recording into an encrypted, signed evidence package, and a transcriber (`apps/transcriber`) can add a transcript. Decision numbers (`D…`) refer to `docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md`.

**Read this first.** The task is done ON THIS MAC WITH FAKE DEVICES, and only that. What has been proven was proven on generated test sources and test doubles: no real network camera and no real microphone has been through a recorded, sealed session. A real speech engine HAS: the local engine (`cpu-local`) transcribed a product session that was started and ended on the tablet, on the synthetic speech fixture, and the session was sealed with an assembled transcript (D211; gate report `docs/2026-10-07_dems_real_capture_sealing/gateway_check/11b_m6_regate.md`). No real voice has been through it. What is built, what is proven, what is NOT met, what is not proven and which decisions are still the user's is said once, in **State at commit `713d83f`** directly below; every limit an operator or an installer has to know is listed once under **Known limits** at the end of this section.

Where a sentence of the body and a sentence of a later block disagree, the later block is right; each such place is named in the block. A sentence that no gate or re-check has verified says so, and names why.

### State at commit `713d83f` (2026-10-11)

Sources: the four reports of the final chain on this commit - verification (`docs/2026-10-07_dems_real_capture_sealing/verification/01_verification.md`), security (`verification/02_security.md`), the final test report (`test/17_row100_final_test_report.md`), the final code review (`gateway_check/22_final_code_review.md`) - and decision D241. Report names below are files of `docs/2026-10-07_dems_real_capture_sealing/gateway_check/` unless a folder is given.

**Tree state: `713d83f` plus batch N (uncommitted at the time of writing).** The tables and verdicts below describe `713d83f` and the four reports of the final chain. The working tree holds, on top of it, the small fixes that decision D241 ruled for batch N (`docs/2026-10-07_dems_real_capture_sealing/implementation/164_batch_n_chain_fixes.md`). They have tests - typecheck and lint clean, shared 2646, core-server unit 6717, core-server database 2426, core-web 2225, mobile 2913 as that note reports them, not re-run for this text - and NO gate: no lane, device or browser has seen them. Built in that tree: a `REAL_PRODUCTION` Core refuses to start while an operator still has the published demo password (S99-01; what remains open is in Known limit 34); the shared log-blanking rule blanks the userinfo of a URL that carries a password (S99-04); `.gitignore` ignores `*.p8`, `*.wrap` and `*.blob` (S99-07); a body of operation 91 that carries `credential` is web console only (S99-09); a pre-check whose probe source throws judges every source not reachable and blocks (V98-13); one rule for a verify part on the web console and the tablet / phone apps - "Not run", never FAIL, for a check that did not run (R101-03); the contract example of `session.captureCheckpoints` (V98-09); the six root test scripts (see **Tests**); a test that cites `M5-SEC-SRC-1` for its suite part (T100-02). The commit that holds them is not made.

**Built, and proven on fake devices.**

| What | Proven by |
|---|---|
| A Core in development capture records two generated cameras and one audio track with a hot-standby microphone, through the built capture worker, shows "recording" only after the first durable fragment, and seals the recording into an encrypted, signed package of schema version 2 | milestone gates M3, M4, M5, M7; the seal end-to-end test (3 of 3) and the development-session end-to-end test (2 of 2) of the final test report |
| An interrupted recording is sealed up to the interruption; a seal that fails is retried, then blocked or ended as unsealable with its files in quarantine; 35 of 35 active kill-matrix cells | M5, M7; final test report Part A row 14 |
| Verify (15 checks) names an altered fragment; the receiver's command checks a downloaded export without a Core | M7, M8 (`13d_m8_final.md` row "receiver's command") |
| The local speech engine transcribes a session and the transcript is sealed; a revision is a signed, appended record | M6 (`11b_m6_regate.md`; D211, D221) |
| Sealed playback on web, tablet and phone with the audio-source band; a tampered file is stopped and named | M8 (`13d_m8_final.md`), the confirmation session of wave M (`14_wave_m_confirmation.md`) |
| Camera search and the connect flow against ONE fake ONVIF camera on loopback; the device selector on three clients | M4 (`09d_m4_final.md`) |
| The whole regression on `713d83f`: 17,494 tests passed, 0 failed, 10 skipped by a stated condition; typecheck and lint clean; contract totals 97 operations (36 GET / 61 POST), 67 audit types, database schema 6 / `dbc-7` | `test/17_row100_final_test_report.md` Part A |

**The milestone verdicts. None is a plain PASS.**

| Milestone | Verdict | Report |
|---|---|---|
| M3 capture worker and supervisor | PASS WITH CONDITIONS | `08_m3_gate.md` |
| M4 discovery, connect, selector | PASS WITH CONDITIONS | `09d_m4_final.md` |
| M5 recording, microphone switch, interrupted and blocked seals | PASS WITH CONDITIONS | `10e_m5_final.md` |
| M6 transcript | PASS WITH CONDITIONS | `11b_m6_regate.md` with `10d_m5_m6_recheck.md` |
| M7 sealing, verify, kill matrix | PASS WITH CONDITIONS | `12d_m7_final.md` |
| M8 playback, export | PASS WITH CONDITIONS | `13d_m8_final.md` |
| Fix wave M | every item confirmed but one count; two MINOR findings open | `14_wave_m_confirmation.md` |
| Final chain | verification PASS WITH CONDITIONS; security CAUTION (0 critical, 1 high, 3 medium); test evidence YES WITH LISTED GAPS; code review YES WITH CONDITIONS (0 blocker, 5 major) | the four reports named above |

**NOT met.** `M8-CMP-1`, the composite video export. It is not built to completion: no encoder is selected until the licence decision on the FFmpeg build is taken, and the job answers `COMPOSITE_ENCODER_NOT_SELECTED` (see **Export**). It is a requirement that is not met, not a condition of a green M8.

**Not proven.** Each of these is outside "done on this Mac with fake devices".

| Not proven | Why |
|---|---|
| The user-attended local-device checks: a session end to end on this Mac's own camera and microphone, the clap check, the "is on" line on three clients | No agent may select, pre-check or start this Mac's camera or microphone (D163, D241); the user has not run them. The local microphone FAILED its only recorded run on its sample rate (D128; `M4-LOCAL-MIC-1`) |
| Class-C hardware: real network cameras, PoE, a TPM signer, the real Core device, physical tablets and phones, a real-LAN camera search (`M4-DISC-LAN-1`) | Not executable on this Mac |
| Biometric sign-in | SKIPPED on the user's instruction, never passed (D151) |
| The server speech backend (`omlx-server`) live; a Core killed while the engine decodes; a `PARTIAL` transcript, a `LABELLED` speaker state, a no-speech session | The user's rule for the speech server; tests only (`11b_m6_regate.md` R1-R3) |
| A one-camera seal, a truncated tail, the kept-plaintext alert, the boot sweep and EVERY `REAL_PRODUCTION` refusal inside a started Core | Tests only (`12d_m7_final.md` F-2). A `REAL_PRODUCTION` Core cannot operate in this tree at all: no production source has an opener, no command provisions a production signing key, and since batch N it also refuses to start on the seed's operators (the demo-password refusal is shown on the booted path by a database test, `apps/core-server/src/modules/devices/__tests__/source-class.db.test.ts:194`, and by no started Core). Corrected 2026-10-14 (integration pass I-9c of the fourth task): "cannot operate at all" is the state of `713d83f`. On branch `task4/input-av-core-port` a production signing key IS provisioned by `npm run evidence:production-key -w @dems/core-server` (`apps/core-server/package.json:24`), the demo password is replaced by `operator:set-password` (`:27`), and production camera and microphone adapters are built (commit `0f5d2a8e`); a production Core starts on a seeded database for a BENCH test only (Known limits 34, 46). Still not proven: no session with a production camera has been recorded and sealed (C108; Known limit 58), and no production start has run on the Ubuntu host (block **Task 4**) |
| Notification B with both cameras unreachable, "Search again" pressed, a start after the acknowledgement; situation C and the degraded start on real capture; `M5-SEC-SRC-1` (no listener for a source kind without an opener): its suite part is proven since batch N by a database test (`apps/core-server/src/capture-session/__tests__/session-capture.db.test.ts:432`: 409 `SOURCE_KIND_NOT_RECORDABLE`, no worker started, no source asked to open); its LIVE part (no listener in 8554-8564 on a started `REAL_PRODUCTION` Core) is not proven and cannot be at this tree, because such a Core cannot boot | `14_wave_m_confirmation.md` section 3; `10e_m5_final.md` C5; final test report gap G1; `implementation/164_batch_n_chain_fixes.md` section 8 |
| The tamper stop for a file that loaded and is altered in its last seconds; a headed browser; a web origin without the development proxy | `13d_m8_final.md` section 6 |
| Power loss, a volume that really runs out of space, a volume without hard links; the ten parked S7 / S8 cells of the kill matrix | By design or class C (D127, D155) |

**The user's open decisions.** None of these has been taken, and no agent takes them (D241).

| Decision | Source |
|---|---|
| The FFmpeg licence: the composite encoder, AND how any real-capture Core is shipped (the capture worker links a GPL-3.0-or-later FFmpeg build dynamically) | D139, D195; security finding S99-08, S99-12 |
| A policy for the quarantine: who keeps, releases or destroys a quarantine folder | D186, D195 |
| SEC35-26, personal data in real evidence: legal basis, retention, erasure, an impact assessment. **Open - not accepted**: no recorded decision of the user accepts this risk | security review row 35; `verification/02_security.md` section 6 |
| S99-02: whether the Core itself must refuse to open this Mac's camera or microphone without a confirmation in the request. Today the confirmation is a rule of the three clients only | `verification/02_security.md` |
| S99-03: a retention rule for the decrypted export archives the Core keeps | `verification/02_security.md` |
| Key escrow (SEC35-09): there is none; losing `<data directory>/credential-store` makes every sealed recording unreadable | `verification/02_security.md` section 6 |
| Data clean-up on this Mac: two local-device recordings under `.data/capture-local/runs/`, about 1.3 GB of test data under `.data/test-row61-row140*`, old raw-audio scratch under `<data directory>/transcriber/sessions/`, lane 2's quarantine folders and its items | D130, D161, D189, D216 |
| Smaller ones: the microphone `--diagnose` run (D136); whether metadata of real items is visible to every role (S99-14); the legal confirmation of fragmented MP4 (OD-21) | `verification/01_verification.md` section 7.3 |

**Structural debt, for whoever continues** (final code review; carried to the next task by D241). The Core states nowhere, for every role, which capture operation it runs: both clients infer "this is a real-capture Core" by at least seven rules from five different members, which is the root of the recurring defect "a simulator value on a real-capture screen" (R101-01). The real Core's engine state IS the simulator's state, and the simulator's dataset is one import away from every Core module; only a reader's own exclusion list and tests keep a dataset value out of a signed manifest (R101-02). The players' stall watch, which failed three gates in a row, is a state machine written as parallel refs inside a component and cannot be fed a recorded event sequence without rendering it (R101-04).

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
| `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` | An operator's stored credential still verifies against the published demo password of the seed (the reason reads `operators=<count>`), or the operators cannot be read (the reason is `OPERATORS_UNREADABLE`: the check fails closed). Boot step `capture.boot`, check 4c, asked after the signing key and before the worker is started; it logs the count only (`apps/core-server/src/capture/boot/checks.ts:631-636`, the count read by `capture/boot/index.ts:689`; line numbers corrected 2026-10-14 on branch `task4/input-av-core-port`, they were `checks.ts:410-416` and `index.ts:183` at `713d83f`). Built in batch N, committed in `035150b2`; on the fourth task's branch `operator:set-password` replaces the demo password and prints the count this check computes (block **Task 4**, C64). No started production Core has been seen refusing it outside a test (S99-01) | `REAL_PRODUCTION` |
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

**The signing key.** The one command above provisions a development key: its certificate says `DEVELOPMENT KEY - NOT FOR PRODUCTION`. A `REAL_PRODUCTION` Core refuses to start with a development key, and the seal refuses to sign a package of production sources with one (D138, D183). It also refuses to start while an operator has the published demo password, which every seeded database has (Known limit 34). **Corrected 2026-10-14:** this paragraph said that no command of this repository provisions a production signing key and that a `REAL_PRODUCTION` Core cannot be brought up from it. Both commands exist since the fourth task - `evidence:production-key` and `operator:set-password` - and with them a production Core starts for a BENCH TEST on the seeded database, not for a real examination: block **Task 4: production key, operator passwords, real cameras, commissioning** below.

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

- **Real evidence can hold personal data**: a voice, a face, a name. The statement of the first demo, that everything is synthetic, does not hold for a recording made in real capture. The security design review recorded this as finding SEC35-26: no consent or legal-basis statement, no retention or erasure rule, no data protection impact assessment and no breach-notification statement exist for this product. This is **OPEN and it is the user's decision**: it is carried through this phase, and no recorded decision of the user accepts it (correction of 2026-10-11: this sentence said "accepted risk of this phase"; the final security review found no such decision, D241). The review's own recommendation is the position this README can state: processing is under the operator's legal mandate; sealed evidence is under legal hold (the product has no erasure of a sealed package, and a reset is refused while real evidence exists); operation stays on loopback and on development sources until the hardware phase. The data protection impact assessment is still to be written by the owner of the deployment.
- **Custody of what is not sealed.** Unsealed recordings, the transcriber's audio tap and the quarantine are plaintext personal data protected by file permissions only (see **Evidence at rest**). Who may read the Core's disk, how long a quarantine folder is kept and who may release it are operator procedures that this repository does not define.
- **The Core Mac's own camera and microphone are a development feature.** They can be selected only in development capture; they do not exist in production capture.
- **The confirmation is a rule of the three clients, not of the Core (security finding S99-02, open).** The Core opens this Mac's camera or microphone for any caller that holds the session-start permission and sends the pre-check or the start through the API: nothing in the request has to state the confirmation. Whether the Core must refuse is the user's decision.
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

**Gate state (updated 2026-10-11).** When this block was written no re-gate had passed. Since then every milestone gate has ended at PASS WITH CONDITIONS (table under **State at commit `713d83f`**). An item below that a gate or re-check report covers names that report; an item that still rests on automated tests only says **not yet gate-verified** and why.

**Two environment keys of the Core: the installation identity.** Read once at start (`apps/core-server/src/config.ts:60-61`; `apps/core-server/src/sealing-host/installation-identity.ts`). Gate state: the `NOT_CONFIGURED` values of a lane's sealed manifest and the boot warning were read at re-gate 89 (`gateway_check/12b_m7_regate.md`, manifest fields 20-27). Setting the two keys, and the `REAL_PRODUCTION` refusal, are not yet gate-verified: tests only (`12d_m7_final.md` F-2).

| Key | Value | Used for |
|---|---|---|
| `DEMS_INSTALLATION_DEVICE_ID` | A device id: a capital letter, then capitals, digits or hyphens, at most 32 characters (the form of `DEMS-JKT-07`; that id itself, `DEMS-IR-01` and `DEMS-TEST-01` are reserved for demonstration data and tests, and a production start refuses them: block **Task 4** below) | Manifest field `device.deviceId` of every recording sealed on this Core |
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

**The speech microphone of development capture.** `DEMS_CAPTURE_DEV_FAKE_MIC` = `tone` (the default) or `speech`; development capture only. With `speech` the first test microphone (`MIC-01` of the seed) plays `.data/dev-fixtures/speech-mic/dialogue.wav` in the place of its tone, in real time and looped; the second test microphone keeps its 880 Hz tone. The fixture is SYNTHETIC Indonesian speech made on this machine by `npm run capture:dev-setup` with the macOS speech synthesiser: no network, no recording of a person, git-ignored, its known text beside it in `dialogue.reference.json` (`scripts/capture/speech-fixture.mjs:9-19`). Set-up options, after `--`: `--no-speech-fixture` (skip the step) and `--renew-speech-fixture` (make it again), for example `npm run capture:dev-setup -- --renew-speech-fixture` (`scripts/capture/dev-setup.mjs:6-7`, `:85`). The local speech engine has transcribed a development session on this microphone and the session was sealed with an assembled transcript, in an automated test (D211); this corrects the sentence "no real speech engine has been through a recorded, sealed session" above and Known limit 15 for the `cpu-local` engine on SYNTHETIC speech only. Since then re-gate 81 confirmed it on a lane: a product session started and ended on the tablet, on this microphone, was transcribed by the local engine and sealed (`gateway_check/11b_m6_regate.md`; D221). No real microphone and no real voice has been through it. No speed figure is stated (D230 of the predecessor task).

**Limits of the transcript step of the seal** (named settings, set in code, no environment key; `apps/core-server/src/sealing/finalize-transcript/bounds.ts:58`, `:64-68`; D201 ruling 3). They are bounds chosen by the implementation, not measurements of an engine.

| Setting | Default | Meaning |
|---|---|---|
| `stepLimitMs` | 1,800,000 ms (30 min) | The upper bound of the whole step, waiting plus closing out |
| `callLimitMs` | 30,000 ms (30 s) | The upper bound of one question to the transcriber |
| `closeOutLimitMs` | 120,000 ms (2 min) | The part of the step kept for closing the transcript out |
| `closeOutAttempts` | 3 | Failures at the bound before the seal goes on without a transcript |

**`scripts/lane/lane.sh`: three options** (the header of `scripts/lane/lane.sh`, lines 6-21; the two rig commands are in the blocks of waves K and of L and M below). Gate state: all three were used by the gate sessions - the camera stub from re-gate 70 on (`gateway_check/09b_m4_regate.md`), the speech microphone at re-gate 81 (`11b_m6_regate.md`), the discard option is named by the re-check of 75 and 81 as what a reset of lane 2 needs (`10d_m5_m6_recheck.md`), but no gate report records a run of it: that option is **not yet gate-verified** (automated tests and the drivers' own use only).

| Command | What it does |
|---|---|
| `scripts/lane/lane.sh start <lane> --with-camera-stub` | Starts the lane's Core through `npm run start:camera-stub -w @dems/core-server` (`apps/core-server/package.json:9`) with ONE fake ONVIF camera on 127.0.0.1 as its ONLY camera search: no multicast and no datagram to the real network. A development-capture lane gets the stub; a `SIMULATED` lane starts without it and says so; a production configuration is not started (`DEV_CAMERA_STUB_IN_PRODUCTION`). The stub's fixture account is made at each start and printed by the script; it is a fixture of the fake device, not a secret. One word in the stub's mode file switches what it answers: `NORMAL`, `AUTH_SCHEME`, `UNREACHABLE`, `NO_PROFILE`, `NOT_H264`, `EMPTY` (`lane.sh:49-60`; D196, D206) |
| `scripts/lane/lane.sh start 2 --speech-mic` | Lane 2 only (development capture): sets `DEMS_CAPTURE_DEV_FAKE_MIC=speech`. On another lane the script stops with exit status 64. The two start options may be given together (`lane.sh:11-13`, `:128`, `:166-167`) |
| `scripts/lane/lane.sh reset 2 --discard-unsealed-fake-recordings` | The reset of the development-capture lane, and it may ERASE unsealed recording folders. See the rule below. On a lane that is not development capture the script stops with exit status 64 and resets nothing (`lane.sh:17-21`, `:232-234`) |

**The FAKE-only rule of `--discard-unsealed-fake-recordings`** (`apps/core-server/src/db/reset/real-evidence.ts:120-121`, `:384`; `lane.sh:62-76`; D216 ruling 4, D217). A reset is still refused (`RESET_BLOCKED_REAL_EVIDENCE`) while the media store holds the folder of a session whose seal did not complete (`SESSION-<id>` without a manifest) or a folder under `.quarantine/`. With the option - and only with it - the reset erases such a folder when the database being reset says its session recorded from EXACTLY FOUR generated (`FAKE`) sources and has no sealed item. A recording from this computer's camera or microphone (`LOCAL_DEVICE`) or from a production device is NEVER erased this way: it still blocks, and a person decides about it; there is no tool for it (D217 ruling 8). The refusal of a reset without the option says how many folders the option would clear. The console's reset never passes the option. Stop the lane first: `scripts/lane/lane.sh stop 2`. This corrects the row `RESET_BLOCKED_REAL_EVIDENCE` of **Reset rules** ("any quarantine folder") and Known limit 29 for FAKE-only sessions.

**Session keys and a reset.** A reset destroys EVERY session key of the key folder of the store it resets; the demo packages it seals anew keep theirs. Session numbers are given out again after a reset; no key of an earlier session survives one (D217 ruling 1). A session whose number meets a key of an earlier session is refused at START, before anything is recorded: `503 NOT_READY`, reason `SESSION_KEY_NOT_OF_SESSION` (or `SESSION_KEY_STORE_UNAVAILABLE` when the key store cannot be used); cancel it and create a new one. This corrects Known limits 23 and 29 ("destroying a session key is not built", "session keys … are not destroyed"). The refusal at START is **not yet gate-verified**: the final re-check of M5 still lists the start-refusal sentence as not proven live (`gateway_check/10e_m5_final.md` condition C5); the same cause at SEAL time was driven there with the seal rig.

**A seal that is retried or blocked.** The Core runs a failed seal again by itself (three retries, after 5 s, 30 s and 120 s). When they are used up the session stays in FINALIZING, a CRITICAL notice names the cause and what restores it, and the clients say "Sealing is blocked" and "The recording is kept on the Core." on a screen that can be left. The Core records no new session until that one is sealed. Known limit 2 stands in one half: there is still no operator action to GIVE UP such a seal. Since fix wave L there IS an operator action to RETRY it, "Retry sealing" on the web console (block **Fix waves L and M** below), and the Core does not retry by itself when the cause heals. Gate state: driven live with the seal rig at the final re-check of M5 (`gateway_check/10e_m5_final.md`).

**Export: one self-contained archive, and the receiver's check** (this corrects the first bullet of **Export**: the export manifest and signature are INSIDE the archive, as its last two entries `export/EXP-<id>.manifest.json` and `.sig`). The receiver of a downloaded archive checks it with:

```sh
npm run evidence:verify-export -- <archive.zip> [--sha256 <hex>] [--trust <certificate sha256>]... [--compromised <certificate sha256>]...
```

- Defined in the root `package.json:62` (script `evidence:verify-export`) -> `apps/core-server/package.json:26` (`tsx cli/verify-export.ts`) -> `apps/core-server/cli/verify-export.ts`. It needs no Core, no database and no key. It needs the system's `unzip`. A relative path is relative to the folder the command is typed in. (Corrected 2026-10-14: the line numbers, and the two repeatable options as the command's header states them.)
- It prints one line per check, X-01 to X-07. Exit status: 0 every check passed, 1 a check failed, 2 the command could not run, 3 nothing failed but the list given with `--compromised` reports a signing key of this export as compromised - not a pass, and not a tamper finding (`apps/core-server/src/evidence-export/receiver-cli.ts:1-41`; what `--compromised` is for: block **Task 4**, "Rotation and the compromise mark").
- Two limits it prints itself. Without `--trust` the signatures are checked against the certificate inside the archive: the result then says only that the export is consistent with itself. Without `--sha256` the archive's hash is printed, not compared: the hash is stated outside the archive, by the export job in the web console and by the audit row of the download, never inside it.
- Finished archives are DECRYPTED copies and are KEPT in the package's `export/` folder until the package is removed by a reset; the product deletes none and lists them on the item page with **Download export** (D205). One archive per export, each the size of the recording.
- Gate state: the receiver's command passed on a downloaded archive alone at re-gate 94 and at both later checks (`gateway_check/13b_m8_regate.md`, `13c_m8_recheck.md`, `13d_m8_final.md`: X-01 to X-07 PASS, exit status 0). The `--trust` form was not driven at a gate.

**What the clients show in real capture.** No stock picture stands as a camera preview: tiles and session rows say "No preview". Time chips say "Host system clock". A source line said "Reachable" or "Not reachable" from the registry row; **corrected by fix wave L: a source at rest that the Core has not checked reads "Not checked"** (block **Fix waves L and M** below), and "Live" only while a session is recording (D196, D210, D217, D231). Gate state: confirmed on web, tablet and phone (`gateway_check/09d_m4_final.md`, `14_wave_m_confirmation.md`).

### Fix wave K: additions and corrections

Added 2026-10-11 by the documentation errata pass (`docs/2026-10-07_dems_real_capture_sealing/implementation/147_docs_errata_wave_k.md`). Fix wave K is in the tree at commit `b05106b` (D226); it was in the working tree when this block was written (D224). The numbered specification errata are `PE-WK-…` in `docs/2026-10-07_dems_real_capture_sealing/masterplan/`.

**Gate state (updated 2026-10-11).** When this block was written no gate had passed on wave K. Since then the re-checks and the final re-checks ran: M4 `gateway_check/09c_m4_recheck.md` and `09d_m4_final.md`, M5 and M6 `10d_m5_m6_recheck.md` and `10e_m5_final.md`, M7 `12c_m7_recheck.md` and `12d_m7_final.md`, M8 `13c_m8_recheck.md` and `13d_m8_final.md` - each PASS WITH CONDITIONS. An item below names the report that covers it, or says what is still not gate-verified.

**The seal rig of the development lane** (`scripts/lane/lane.sh:22`, `:83-108`, `:200-231`, `:334`; `apps/core-server/test/support/lane-seal-rig.ts`; API contract and capture spec erratum `PE-WK-14`). A development tool that makes the seal of ONE session fail on purpose, with a cause the product already has, so that the "sealing is blocked" screens and the quarantine outcome can be driven. It is a FOURTH command of the script, beside the three start / reset options above (the source rig of wave M is the fifth). Gate state: driven live by a gate verifier in both words - `blocked` then `release` and the retry, and `unsealable` to the quarantine - at the final re-check of M5 (`gateway_check/10e_m5_final.md`), and by the drivers of waves L and M.

| Command | What it does |
|---|---|
| `scripts/lane/lane.sh seal-rig 2 blocked` | Set BEFORE the session is ended. The seal of the next session that ends fails with the cause `SESSION_KEY_STORE_UNAVAILABLE` (retriable): retries after 5 s, 30 s and 120 s, then a CRITICAL "sealing blocked" notice for as long as the switch is on; the session stays FINALIZING |
| `scripts/lane/lane.sh seal-rig 2 unsealable` | Set BEFORE the session is ended. The seal fails with `SESSION_KEY_NOT_OF_SESSION` (not retriable): three attempts (at once, after 5 s, after 30 s), then the session ends UNSEALABLE: recordings MOVED to `<media root>/.quarantine/<sessionId>/`, session INCOMPLETE, one CRITICAL alert, a new session can be created at once |
| `scripts/lane/lane.sh seal-rig 2 release` | The switch is OFF. A blocked seal then completes by the product's own retry: the next automatic retry if one is still due, else the recovery action of the session on the web or the tablet, else the next start of the lane. ALWAYS end with it |
| `scripts/lane/lane.sh seal-rig 2 status` | What the switch file (`.locks/seal-rig.lane2.switch`, mode 0600) says: `OFF`, `BLOCKED`, `UNSEALABLE`, or either with the session it is bound to |

- **FAKE sources only.** The rig binds to the first session whose seal it meets and whose start record holds only generated (`FAKE`) sources; no later session is touched until the switch is set again. A session that recorded from this computer's camera or microphone (`LOCAL_DEVICE`) or from a production device is never touched: its seal is let through and the Core logs `LANE_SEAL_RIG_NOT_A_FAKE_SESSION`.
- **Refused outside development capture.** `lane.sh seal-rig` on a lane that is not development capture stops with exit status 64 and changes nothing (`lane.sh:212-214`); a production configuration is not started with the rig (`DEV_SEAL_RIG_IN_PRODUCTION`) and the sealing host itself refuses it outside `REAL_DEVELOPMENT` (`DEV_SEAL_RIG_NOT_DEVELOPMENT`).
- **Off by default.** The rig exists only on a lane started with `scripts/lane/lane.sh start 2 --with-camera-stub`; the start prints "seal rig available (development tool) ... says: OFF". A lane started without the stub has no rig and `seal-rig` says so (exit status 69). The product's own entry point cannot load it. No key file is written, read or planted.
- After `unsealable` the lane holds a quarantine folder: stop the lane, then `scripts/lane/lane.sh reset 2 --discard-unsealed-fake-recordings` (the FAKE-only rule above).

**Other changes of wave K the README text above does not yet say** (each is in a numbered erratum; gate state per item):

- **The restart fault ends** (`PE-WK-11`). The "The Core was not running while this session was active" fault is active only while its session is open as that faulted session; when the session is sealed or closed it is cleared with one `FAULT_CLEARED` row, and a start of the Core heals a fault that an earlier build left stuck. Gate state: held at the re-check of M5 (`gateway_check/10d_m5_m6_recheck.md`).
- **The manifest states the recorded stream** (`PE-WK-16`). `tracks[].profile` is the format the recorded stream itself declares in the camera file (picture size and frame rate from its initialisation segment, never a measured average), for example `H264_720P30`, not the selector's line; a session whose declared format is not the configured profile carries one WARNING notice `STREAM_PROFILE_DIFFERS`. At a development start the selector line of a generated source is corrected to the profile its adapter makes (`PE-WK-15`). Packages sealed earlier are unchanged and stay valid: one package of lane 2 (`EV-20261011-0025`) keeps a fractional profile label and its notice for ever, sealed by the build before the correction (D226). Gate state: `H264_720P30` on both tracks and no notice at the final re-check of M7 (`gateway_check/12d_m7_final.md`).
- **Limits of the sealed package and the export** (`PE-WK-17`, `PE-WK-18`, `PE-WK-19`). A copy of a sealed package whose `transcript-revisions.json` lost its last revision (or all of them) verifies PASS without the Core: only the Core (against its database) and an export (`X-04 ENTRY_HASH_MISMATCH`) catch it. The receiver's command names an added file `X-04 UNEXPECTED_ENTRY` (export) or `V-14 UNEXPECTED_FILE` (package). The download link is NOT single use inside its 60 seconds, for the same sign-in session; each download is its own audit row. These three are stated limits, not behaviour a gate passes.
- **The tablet's player seeks on the indexed view** (`PE-WK-35`, `PE-WK-37`; supersedes `PE-WK-24` for a session whose answer states an index): the app asks operation 88 for the view with the optional `seekIndex` and the scrubber seeks; where a stream still reports no duration, the scrubber stays disabled with a sentence and Play and Pause work. Gate state: seeking was driven on the tablet AND on the phone at the final re-check of M8 (`gateway_check/13d_m8_final.md`, rows "seek at about 50 %" and "play / pause / one seek").

### Fix waves L and M: additions and corrections

Added 2026-10-11 by the documentation pass of batch N (`docs/2026-10-07_dems_real_capture_sealing/implementation/165_batch_n_docs.md`). Fix wave L is in the tree at commit `7b1aded` (D231), fix wave M at commit `a5d75ed` (D237). The numbered specification errata are `PE-WL-…` and `PE-WM-…` in `docs/2026-10-07_dems_real_capture_sealing/masterplan/`. Gate state: wave L was held by the final re-checks of M4, M5, M7 and M8 (`gateway_check/09d_m4_final.md`, `10e_m5_final.md`, `12d_m7_final.md`, `13d_m8_final.md`); wave M by one confirmation session (`14_wave_m_confirmation.md`). An item that rests on tests only says so.

**Development tools at a glance** (all of `scripts/lane/lane.sh`; lane `2` is the development-capture instance).

| Tool | Command | What it is for |
|---|---|---|
| Lanes | `scripts/lane/lane.sh start <main\|1\|2\|3>`, `stop <…>`, `status`, `reset <…>` | The main instance and three lane instances, each with its own database and its own media store |
| Camera stub | `scripts/lane/lane.sh start <lane> --with-camera-stub` | ONE fake ONVIF camera on loopback as the lane's only camera search; also what makes both rigs available on lane 2 |
| Speech microphone | `scripts/lane/lane.sh start 2 --speech-mic` | The first test microphone plays the synthetic speech fixture |
| Seal rig | `scripts/lane/lane.sh seal-rig 2 unsealable\|blocked\|release\|status` | Makes the seal of ONE session of generated sources fail on purpose (block **Fix wave K**) |
| Source rig | `scripts/lane/lane.sh source-rig 2 unreachable <CAM-NN\|MIC-NN>`, `source-rig 2 release`, `source-rig 2 status` | Makes a generated source answer as not there (below) |
| Reset option | `scripts/lane/lane.sh reset 2 --discard-unsealed-fake-recordings` | The reset that may erase unsealed folders of sessions that recorded from generated sources only (block **Fix waves H and I**) |

**The source rig of the development lane** (`scripts/lane/lane.sh:27-28`, `:120-147`, `:246-276`; `apps/core-server/test/support/lane-source-rig.ts`; capture spec erratum `PE-WM-06`). The test sources of development capture are generated on this machine and dial nothing, so a configured source that "does not answer" could not be shown. This tool makes a generated source answer as a source that is not there, through its adapter's own failure path.

| Command | What it does |
|---|---|
| `scripts/lane/lane.sh source-rig 2 unreachable CAM-02` | From the NEXT pre-check run on, `CAM-02` does not answer: the product's own pre-check reports it (the device not online, its check row a warning or a block by the start rule, one alert and one audit row per occurrence), and a session start is refused that source. A second call with another device ADDS it, up to FOUR devices; a fifth is refused |
| `scripts/lane/lane.sh source-rig 2 release` | The switch is OFF. Every source answers again at the next pre-check run; the alert is resolved by that run, not by the release. ALWAYS end with it |
| `scripts/lane/lane.sh source-rig 2 status` | What the switch file (`.locks/source-rig.lane2.switch`) says: `OFF`, or `UNREACHABLE` and the devices |

- **Generated sources only, cameras and microphones** (`CAM-NN` or `MIC-NN`; any other word stops with exit status 64). This computer's camera and microphone and a production source are never touched: a switch that names one changes nothing for it and the Core logs `LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE`.
- **Refused outside development capture.** On a lane that is not development capture the script stops with exit status 64 and changes nothing; a production configuration is not started with the rig (`DEV_SOURCE_RIG_IN_PRODUCTION`); the capture fence accepts the switch in development capture alone.
- **Off by default, and live.** The rig exists only on a lane started with `--with-camera-stub`; the start prints "source rig available (development tool) ... says: OFF". It takes effect on the RUNNING lane, with no restart, at the next pre-check run or session start - never by itself.
- **It does not end an open source.** It opens nothing and ends nothing: a recording that is running goes on.
- Gate state: driven live on the web, the tablet and the phone (`gateway_check/14_wave_m_confirmation.md`; `implementation/160_fix_wave_m_m.md`).

**A blocked seal can be retried from the web console.** After the stop the Core runs a failed seal three more times by itself (5 s, 30 s and 120 s after the failure before: the last run 155 s after the first). Then the seal is BLOCKED and **the Core waits: it does not run the seal again by itself when the cause heals.** It runs again at a start of the Core, or when an investigator or a supervisor presses **Retry sealing** on the Session Monitor of the web console (banner and seal dialog). Other roles read who can; the tablet and the phone have no retry control and say so. This corrects the block of waves H and I ("no operator action") and Known limit 2 in its first half. Gate state: `gateway_check/10e_m5_final.md`.

**A recording that could not be sealed leaves an open notice.** The CRITICAL alert of a session that ended unsealable stays active - through later sessions and restarts - until a SUPERVISOR acknowledges it ("Acknowledge and close" in the alerts). That closes it and writes one audit row. It blocks nothing: the next session can be recorded at once, and the header says "OPEN NOTICE", never "all systems operational". **Known gap:** the acknowledgement of any other role marks the alert and leaves it open, and writes NO audit row (no audit type fits; D237).

**What the clients show in real capture (the one rule).** A screen of a Core in its own capture states the Core's own fact, or "Not reported", or nothing. A block that still shows values of the appliance model carries the chip **"Synthetic demo values"**. A source at rest that the Core has not checked reads **"Not checked"** on web, tablet and phone; "Reachable" / "Not reachable" need a checked fact; "Live" is said only while a session records. A generated source is named **"Generated test source"**, never by a product name. Sources and the microphone pair are named from the selector in force: the snapshot of a session counts only while that session is open. Limit: this is a rule kept screen by screen (structural debt R101-01 above); the words "READY" of the pre-check rows are still the engine's track words (D231).

**The item states its sealed format.** An evidence item of a sealed package shows, per camera file, the format the signed manifest states ("Sealed format (signed manifest)") and, when the Core still holds it, the notice that the recorded stream was not the configured profile. The notice is read from the Core's newest 100 alerts: for an older item its absence does not mean "equal".

**Session New on the tablet and the phone.** While a session is in setup the header has **Cancel session**; Back opens a dialog with three choices ("Keep session", "Go to Home, keep the session open", "Cancel session"); a form whose session was cancelled on another client is cleared and says so. At a pre-check that names an unreachable source the step offers "Search again", "Run checks again" and, where the start rule allows it, the acknowledgement. It does NOT offer "choose another source": the selector is locked while a session exists, so cancel the session, change the selector, start again (D237).

**The web tamper demonstration.** A camera file that does not authenticate is stopped and named with its fragment while the other file plays on, also when playback is started near the end. Not proven: a file that loaded and is altered in its last seconds, a headed browser, a web origin without the development proxy (`gateway_check/13d_m8_final.md` section 6).

**Open findings of the confirmation session** (`gateway_check/14_wave_m_confirmation.md`; ruled for the fix batch after the UI judging session, D239). GM-01: in the web console's Session New at 1440 x 900 the row of an unreachable camera is cut after "The sessi…": the consequence ("The session will record one camera only") is not readable on the step. GM-02: the Security & Audit tile counts the items without a verify run from the newest 1,000 audit rows only, so on a Core with a longer trail the number is not the number of never-verified items.

### Task 4: production key, operator passwords, real cameras, commissioning

Added 2026-10-14 by the documentation row of the fourth task (`docs/2026-10-12_input_av_core_adapter_plan/`; record `implementation/c2_readme_and_installer_note.md` of that folder). It describes the tree at checkpoint commit `1fbeada7`. Decision numbers `U…` and `C…` in this block and in Known limits 46 to 58 refer to `docs/2026-10-12_input_av_core_adapter_plan/decisions/decisions.md`. The installer's order of the steps is in `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md`. The production microphone on a Mac is NOT described in this block; it is written by a later row.

**Read this first.** `1fbeada7` is a checkpoint: typecheck, lint and the static rule sets ran on it, the full test suite did not (decision U26). Every statement below rests on tests on the development Mac with test doubles - a generated test camera, a fake ONVIF device, stand-in programs, keys and operators made for the tests. No command and no check of this block has been run on the Ubuntu 24.04 host. No session with a production camera has been recorded and sealed: no composition puts a production camera into a session before the step of the task that lets a production Core open its sources, and that step is not made (C108). Where the block says "refuses", "states" or "verifies", read "by a test on this Mac".

**The two commands of a first production boot** (each line is the script entry of `apps/core-server/package.json` with the arguments its command file states; run from the repository root, as the user the Core runs as, never as root, with the Core stopped).

| | Command | What it does |
|---|---|---|
| X-2 | `npm run operator:set-password -w @dems/core-server -- --database <name> --data-dir <dir> (--username <u> \| --all-demo)` | Replaces the published demo password of the seeded operators. Each operator types their own password at a hidden prompt, the Supervisor first; no option, variable or file carries a password. Per operator: one credential, that operator's sessions ended and biometric sign-in revoked, one audit row `OPERATOR_PASSWORD_SET`. Its last line is the count that boot check 4c computes (C64) |
| X-1 | `npm run evidence:production-key -w @dems/core-server -- --data-dir <dir>` | Makes the production signing key in `<dir>/signer`: a software Ed25519 key in files of the host, a self-signed certificate valid 1,825 days. Organisation and installation device id are typed at its prompts, not given as arguments (C54). It asks no secret, refuses a store that holds anything (`KEY_EXISTS`), and refuses a reserved installation id as soon as it is typed (`INSTALLATION_ID_RESERVED`) |

**What a production boot checks about the key and the operators** (boot step `capture.boot`, `apps/core-server/src/capture/boot/checks.ts`; `REAL_PRODUCTION` only except check 4).

| Check | Refused when | Code |
|---|---|---|
| 4 | No evidence signing key loads from `<data directory>/signer`; also a key marked compromised (`KEY_COMPROMISED`) and a certificate that does not cover now | `CAPTURE_SIGNING_KEY_UNUSABLE` |
| 4b | The key is a development key | `CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION` |
| 4b-2, the installation binding | The whole organisational unit of the active certificate is not exactly `Evidence signing <installation id>`, with the id of `DEMS_INSTALLATION_DEVICE_ID`. A Core with no configured id is refused here too, reason `INSTALLATION_ID_NOT_KNOWN`: on a production boot this comes before the refusal `INSTALLATION_IDENTITY_NOT_CONFIGURED` named under **Fix waves H and I**, which is then never reached (C79, C81) | `CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH` |
| 4b-3, the reserved ids | The configured installation id is `DEMS-TEST-01`, `DEMS-IR-01` or `DEMS-JKT-07`: ids of the tests, of the published demonstration data and of this documentation. **No installation may be configured with one of them**, even when its key names it (C86) | `CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS` |
| 4c | An operator's stored credential still verifies against the published demo password, or the operators cannot be read | `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` |

Four statements the security review of these commands asks every reader to know (`docs/2026-10-12_input_av_core_adapter_plan/verification/07_security_x1_x2.md`; requirement SX-20):

- **Checks 4, 4b, 4b-2, 4b-3 and 4c are necessary conditions, not proof of correct provisioning.** A production Core that starts has a key that loads, is not a development key and names the configured installation, and no operator with the demo password. That the key was made by the right person, with true names, and that each password is known to its operator alone, is not shown by the start.
- **The host account of the user the Core runs as has full control** of every operator account (it can set any password), of the audit log and of the signing key with its wrap secret. The two commands add no power to that account; they add a procedure and an audit row that an honest installer leaves behind.
- **The certificate is self-signed.** No certificate authority and no chain stands behind it; the organisation and the installation in it are names the installer typed, proven by nobody; the signing instant of a package is the signer's own clock; there is no revocation channel. A receiver trusts a package only through the certificate fingerprint handed to them out of band.
- **The production boot this gives is a BENCH boot on the seeded database** (U20 (5)). No operation of the product creates operators: the accounts are the three demonstration persons of the seed with new passwords, and the database carries the demonstration data set. There is **no key escrow and no hardware key store** (U20 (6)); both are to be decided before a real installation.

**Two keys, opposite risks** (Known limits 37 and 47 keep them apart).

| | The signing key | The session keys |
|---|---|---|
| Where | `<data directory>/signer` | `<data directory>/credential-store` |
| What it does | Signs every sealed package, export and transcript revision | Opens (decrypts) the sealed recordings |
| The risk | A COPY: a second ability to sign evidence outside the host. A lost key is replaced by a rotation; what it signed still verifies against its certificate | A LOSS: every sealed recording is unreadable for ever |
| Backup | The key file and its wrap secret are NOT copied into a backup, an image or a support bundle; the certificate is public and is kept | No escrow exists; whether and how it is backed up is the user's open decision (Known limit 37) |

**The review's two lists** (section 6 of the security review, 2026-10-13; a state added in brackets is from a later decision row and is "in code, on this Mac").

*A. Must be closed BEFORE a production recording of a real examination.*

| # | What |
|---|---|
| A1 | Real, named operator accounts. With the seeded accounts every audit row and custody entry names a person of the demo data set |
| A2 | A production seed: roles and permissions without demo persons, cases and evidence; `db:seed` and `db:reset` refuse a production environment |
| A3 | The sign-in cards show no demo disclosure in `REAL_PRODUCTION` |
| A4 | Rotation, the compromise mark and the retained certificate set [built: "Rotation and the compromise mark" below; the review of it as built made this statement, conditional on the full suite and its commit (C84)] |
| A5 | Read-path hardening of the signer store |
| A6 | The fingerprint handed to whoever will verify, by a channel other than the packages, and the list of receivers kept |
| A7 | Each operator's password known to that operator alone: typed by the operator at the installation, or a signed-in password change exists |
| A8 | The user's decision on Known limit 37 (no escrow of the session keys) |
| A9 | One complete `REAL_PRODUCTION` start on the production host, Linux, and the attended hardware acceptance |

*B. Acceptable for a bench test on the user's bench, IF STATED - this table is that statement.*

| # | What | Condition |
|---|---|---|
| B1 | The three demo persons as accounts | with non-demo passwords set by X-2; recordings are test recordings, named as such |
| B2 | The demo data set in the database | no real examination is recorded into it |
| B3 | The cards still print the (now useless) demo password | loopback only |
| B4 | One key id, no rotation, no compromise command [the two commands are built since the list was written] | the key protects test recordings only |
| B5 | Self-signed certificate, no hand-over yet | nobody outside receives a package as evidence |
| B6 | No console password change; every change needs the host | stated |
| B7 | No escrow of session keys | bench recordings are disposable |
| B8 | macOS host: the Linux host profile unchecked | stated as the reason the bench gate is not a production gate |

**What a production Core that starts still lacks** (gaps G1 to G6 of `masterplan/05_design_x1_x2.md` of the task folder). G1: the operators of a production database are the three persons of the demo data set; no operation creates an operator. G2: a production database is a seeded database - `db:seed` is the only source of roles, permissions and operators, and writes the demo data set with them; what else of the data set reaches such a database was not inventoried. G3: both sign-in cards still print the demo password and fill it in. G4: no signed-in password change - every change needs the host and a stopped Core. G5: no escrow of the credential store (Known limit 37). G6: a whole `REAL_PRODUCTION` start has never been run on the production host.

**Rotation and the compromise mark** (C69, C77, C81, C84, C91; U21 (3)).

| Command | What it does |
|---|---|
| `npm run evidence:rotate-key -w @dems/core-server -- --data-dir <absolute directory>` | Makes a NEW signing key with the next key id of the series and makes it the active one (pointer file `signer/ACTIVE`). Organisation and installation device id of the new key are typed at its prompts, then the word `ROTATE`. Nothing of the earlier key is changed or removed |
| `npm run evidence:mark-compromised -w @dems/core-server -- --data-dir <absolute directory> --key-id <key id>` | Sets the compromise mark of ONE NAMED key (there is no default to the active key), after the word `COMPROMISED`. The marked key loads for nobody from then on. No command takes a mark back |

- Both run as the Core's user, never as root, with the Core stopped. Neither opens the database, neither can see a running Core, and neither writes an audit row. Exit status of both: 0 done, 1 refused or failed, 2 usage.
- **After a rotation the Core must be RESTARTED before it seals or signs again.** A running Core is bound to the key its boot judged: once the active key changed, a seal, an export and a transcript revision are each refused with `ACTIVE_KEY_CHANGED` until the Core is started again. With a mark set on its key a running Core signs nothing more (`KEY_COMPROMISED`).
- **A retired key's private half is KEPT** (U21 (3)): the rotation leaves the earlier key file, wrap secret and certificate in place, and so does the mark. They are protected like the active key until the user rules otherwise. The certificate of every earlier key is needed to verify what that key signed.
- **The next boot records the change.** Its `SYSTEM_BOOT` audit row states `signingStoreChange` against the previous boot row of the same database (members below). A rotation or a mark is in the audit chain only after that next start; after `evidence:mark-compromised` on the active key the next start is refused, and the row is written all the same.
- **A package sealed under a marked key is never a plain pass.** On the Core it verifies only when it matches the digest the Core stored at the seal, and then with the notice `SIGNED_BY_COMPROMISED_KEY` (the verification is audited as a WARNING with that notice); a copy that differs FAILS. It can be exported with the statement: the export manifest, signed by the active key, carries `sourceSigningKey` with state `MARKED_COMPROMISED`; a source that is not of record fails `SOURCE_SIGNED_BY_COMPROMISED_KEY`.
- **A RECEIVER learns of a mark only from a list of fingerprints sent out of band.** A package cannot say of itself that its key was marked later. The receiver gives the list to the command: `npm run evidence:verify-export -- <archive.zip> --trust <certificate sha256> --compromised <certificate sha256>`.
  - Who sends it and how: the installation's owner of the key, to every person on the kept list of receivers of the fingerprint, by the channel the hand-over record went by - never inside or beside a package. The marked fingerprint is the one already in the receiver's hand-over record.
  - The two verdicts, as the command prints them: `RESULT: NOT A PASS - signature valid, key reported compromised by the list supplied` (exit status 3: nothing failed, but a signing key of the export is in the list and the receiver holds no record of the Core to hold the package to); `RESULT: PASS - UNDER A SIGNING KEY MARKED COMPROMISED: verified by the exporting Core against the digest it recorded at the seal, as this export states` (exit status 0: an export made AFTER the mark).
  - The export's statement covers a listed fingerprint only in an anchored run: the receiver passes `--trust` for the certificate of the key that signed the export (the active key) and for the marked certificate of the seal. Without `--trust` the same archive is "not a pass" when the list names it.
  - Evidence delivered BEFORE the mark states nothing: with the list it is "not a pass". The installation exports it again after the mark and sends that export.
  - A receiver's command older than this version refuses an export manifest that carries `sourceSigningKey` (`EXPORT_MANIFEST_INVALID`): the receiver needs the command of this version.
- The order after a suspected compromise: mark, then rotate, then start the Core, then tell every receiver.

**What the signing members of a `SYSTEM_BOOT` audit row mean.** "`signingKeyId` and `signingCertificateSha256` of a `SYSTEM_BOOT` entry state the certificate that lay in the signer store when the capture fence passed. The entry is written BEFORE boot checks 4, 4b and 4c: it does not say that the key loaded, matches the certificate, is valid, is not compromised or is not a development key, nor that this boot went on to start." The same holds for the four members of the store: `signingKeysRetained` (a count), `signingKeysCompromised` (the two-digit places of the marked keys in the series, comma-joined; empty = none), `signingCertificatesSha256` (a digest of the retained set) and `signingStoreChange` = `NO_EARLIER_STATEMENT`, `NONE`, `NOT_READ`, or one or more of `KEY_ROTATED`, `KEY_MARKED_COMPROMISED`, `KEY_MARK_REMOVED`, `RETAINED_SET_CHANGED`. A row that names a change has severity WARNING. A boot that is refused a moment later leaves its row.

**Platforms of a production Core** (U21 (2), C66, C97).

- A `REAL_PRODUCTION` Core starts on Linux and on macOS (this Mac). Any other platform, and a platform that is not stated, is refused: `CAPTURE_HOST_PLATFORM_NOT_SUPPORTED`, reason `PLATFORM_NOT_LINUX_OR_DARWIN`.
- **Linux is the hardened form**: every question of the host profile (`scripts/host/HOST-PROFILE-UBUNTU-24.04.md`) is asked at every start and each missing prerequisite refuses by its own code. Linux is unproven on hardware.
- **On a Mac the Linux host profile is NOT asked**, and the Core says so instead of passing silently: the warning `CAPTURE_HOST_PROFILE_NOT_ASKED` at the start; the `SYSTEM_BOOT` row states `hostPlatform` and `hostProfile` (`WILL_BE_ASKED`, `WILL_NOT_BE_ASKED` or `PLATFORM_NOT_SUPPORTED`; "will", because the row is written before the checks); every package sealed there carries the signed member `hostProfileNotAsked` with the platform, and verify and the receiver's command report it as the notice `HOST_PROFILE_NOT_ASKED`. A package sealed on Linux or in development capture carries no such member.
- What a reader may conclude from the member: the recording host was not held to the host profile by the Core. Not that the host was unsafe, and - where the member is absent - not that a Linux host was correctly prepared beyond what the Core can ask (Known limit 48).

**Real cameras** (C60, C70; ruling C36).

- **A camera of source class PRODUCTION - an adopted ONVIF camera - is assignable only under `REAL_PRODUCTION`, and is recorded under no other operation.** A development-capture Core refuses the assignment (`422`, reason `PRODUCTION_SOURCE_NOT_ALLOWED`: "it is a production device, and this Core runs in development capture operation"). This is the fence as designed and is not loosened.
- **An assignment needs a stored stream profile.** The Core picks no default profile for a camera: an assignment without one is refused (`CAMERA_PROFILE_NOT_STATED`), and so is a profile that is not one of those stored for that camera (`CAMERA_PROFILE_NOT_OF_DEVICE`). The stored profiles are the ones a connection test read from the camera's own stream.
- **Under production the connection test is bound to the camera interface.** The Core dials a camera only from the address of the configured camera interface, inside the configured camera subnet. A camera that still has its factory address outside that subnet cannot be connection-tested: it is first brought into the subnet by the commissioning functions below. With no camera network configured the test is refused with `409`, reason `COMMISSIONING_NOT_CONFIGURED`; every other refusal of the address rule is `409`, reason `CANDIDATE_NOT_TESTABLE`.
- **A camera whose address changed is confirmed by the operator.** The Core does not follow a camera to a new address by itself: a search shows the camera at its new address and an operator with the capture configuration permission confirms it in the web console (operation `confirmCaptureDeviceAddress`, audit row `CAPTURE_DEVICE_ADDRESS_CHANGED`).
- **A camera whose stream is lost, and its restart** (row V7, C115, C126 (2); added 2026-10-14). When the Core loses a camera's stream inside a session (it raises the critical notice), the camera's state reads LOST on every screen until the Core sees it again; a LOST camera is the one whose PoE port an operator may cycle (rule OD-22) - note that this Core does not yet perform a PoE cycle: operation 48 is a plain device restart (finding F-V7-1).

**New facts of the evidence: audio absent across a restart, a camera absent inside a session** (C73, C99, C108).

| Fact | Signed member of `session-manifest.json` | Verify notice | Audit row (unsigned extract) |
|---|---|---|---|
| The capture worker was restarted inside a session and no sound was recorded across the restart | `audio.absentOnRestart[]`: per restart the earlier and the later attempt, `absentAtLeastMs`, `absentAtMostMs` | `AUDIO_ABSENT_ON_RESTART` | `CAPTURE_AUDIO_ABSENT_ON_RESTART` |
| A camera stopped delivering inside a session, and came back (`RE_OPENED`) or did not (`NOT_RE_OPENED`) | `tracks[].absentInSession[]`, with the two bounds of each absence | `VIDEO_ABSENT_IN_SESSION` | `CAPTURE_VIDEO_ABSENT_IN_SESSION` |

- Both members are optional. A package of a session without such an event carries neither and is byte for byte what it was before; packages sealed earlier verify unchanged.
- **What a reader can conclude.** That the Core itself stated, under the package signature, that sound or a picture is missing, how often, and between which two bounds in milliseconds. The bounds are a least and a most, not a measurement of the exact gap: the wider bound is the honest one.
- **What a reader cannot conclude.** From the ABSENCE of a member, that nothing was lost: other losses - a microphone lost while its worker ran, the switches of the audio source - are still stated only in the audit extract, which the signature does not cover (Known limit 7). Nor the cause of an absence. And `timeline.recordingDurationMs` of a restarted session still spans the session and is longer than the audio track.
- Shown so far with the relay's loss reports supplied by the test, not by the built relay inside a session (C108).

**Commissioning: the address helper and the camera network** (C94 (j), C101, C102, C105; rulings U9, U10).

- The commissioning functions of a production Core on Linux, web console only, permission `CAPTURE_COMMISSION` (Technician): the camera network configuration (camera interface, camera subnet, factory address list); `scanFactoryCameras` (an active scan of the factory address list from a temporary host address); `getHostAlias` and `removeHostAlias` (the temporary address); `setCameraNetwork` with `getCameraNetworkJob` (gives ONE camera its address in the camera subnet); the installation acceptance. Anywhere else they answer `409` with reason `COMMISSIONING_NOT_AVAILABLE`.
- **The address helper is optional, and all or none.** It is a root service on a local socket of the Linux host (`scripts/host/netalias/`) that adds and removes one temporary address at a time. A host with NOTHING of it starts: the fact is stated - the warning `CAPTURE_HOST_ALIAS_HELPER_ABSENT`, and `addressHelperSocket: NOT_PRESENT` in the `SYSTEM_BOOT` row - and the scan and the address change answer `COMMISSIONING_HELPER_NOT_CONFIGURED`. A helper that is present but wrong - a socket of another owner or mode, a configured path that is not the installed one (`CAPTURE_HOST_ALIAS_SOCKET_PATH`), or only a part of the installation - REFUSES the start.
- **Linux only.** A Mac has no helper.
- **NOT RELEASED for an installation before its host checks pass** (C101, C122). The security review's statement on the helper IS MADE (review row 119c, decision C122; corrected 2026-10-14 - it was made earlier for a previous file, which the two changes of row H5 replaced): "S13-08 to S13-10 are closed in the helper as delivered", in code, for the delivered file of SHA-256 `3621e79ccebb05d052efa06b9c1c0dd4d5d4e30d08c2f55f39019857cc7e4914` - the hash on line 1 of `scripts/host/netalias/SHA256SUMS`, which the hardware procedure prints before an installation. It holds for that file only: any change of the helper needs a new reading by the security review. What it does not cover: S13-10 (a), the end of a temporary address by its kernel lifetime alone, is closed only when `9A/H-06` passes on the host, and what the installed helper does under the service manager is shown only by the host checks `HI-01` to `HI-08`, `9A/H-05` and `9A/H-25`. None of them has run. No use on an installation before they pass.
- **Limits of the functions.** One factory-address camera is connected at a time: the scan states `deviceCount` as `ONE`, `MORE_THAN_ONE` or `NOT_KNOWN`, and a count of the devices that share one factory address is not built, so `NOT_KNOWN` is what it says when it cannot count (Known limit 53). The address change is bound to the hardware address the technician saw in the scan (`scannedMac`; refusals `CAMERA_HARDWARE_ADDRESS_NOT_BOUND`, `MAC_MISMATCH`); a scan older than 10 minutes is refused (`CAMERA_SCAN_TOO_OLD`). The camera search stays an active scan only: no passive monitor, no packet capture.
- **The installation acceptance records the acceptance CHECKS only**: the 27 checks `9A/H-01` to `9A/H-27` of the hardware procedure, each `PASS`, `FAIL` or `NOT_RUN`. The preparation steps and the helper-installation steps are the installer's own record. Nothing reads an acceptance to allow a recording.

**Configuration keys of production capture** (read once, at start; `apps/core-server/src/config.ts:72-75`; they extend the keys of **Capture operation** and of the installation identity above).

| Key | Value | Unset |
|---|---|---|
| `DEMS_CAPTURE_RELAY` | Absolute path of the camera relay program, started by the production door only. With it, `DEMS_CAPTURE_GUARD`: the guard program of a helper | A production start is refused by the host checks (`CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE`, `CAPTURE_HOST_GUARD_PROGRAM_UNUSABLE`) |
| `DEMS_CAPTURE_AUDIO_HELPER` | Absolute path of the audio helper program of production capture, started by the guard, never directly | No production microphone can be opened |
| `DEMS_CAPTURE_ALIAS_SOCKET` | Absolute path of the address helper's socket. On a production Core it must be THE path the delivered socket unit installs | The helper is "not configured": the commissioning functions that need it answer `COMMISSIONING_HELPER_NOT_CONFIGURED` |

### Known limits

One list. Each item names the decision that recorded it. Items 34 to 45 were added on 2026-10-11 from the final chain's reports; items 2, 15 and 26 were corrected in place on the same day. On 2026-10-14 the fourth task rewrote items 7, 25, 30 and 34, added one sentence to item 37 and added items 46 to 58; their decision numbers `U…` and `C…` are those of `docs/2026-10-12_input_av_core_adapter_plan/decisions/decisions.md`, and what they rest on is said at the head of block **Task 4** above (tests on this Mac with doubles; nothing run on the Ubuntu host).

| # | Limit | Decision |
|---|---|---|
| 1 | Recorded media and the transcriber's raw audio tap are plaintext on the media store until the seal completes, and through a crash until recovery seals them. Protection is the owner-only media store. Encrypting while recording is not built | D147, D167, D183, D189 |
| 2 | A recording that cannot be sealed ends its session INCOMPLETE; its files stay in `.quarantine/<sessionId>/` in plaintext. The product cannot bring them back into a seal, and there is no operator action to give up a seal that keeps failing for a cause that may clear: that session stays in FINALIZING and blocks new sessions until the cause is removed AND someone presses "Retry sealing" on the web console or the Core is restarted - the Core does not retry by itself when the cause heals (corrected 2026-10-11) | D178, D186, D231 |
| 3 | Moving a media store needs a manual rename of its session-key folder; no command does it. Old scratch under `<data directory>/transcriber/sessions/` is deleted by hand | D180, D189 |
| 4 | A camera clock up to 2 s off is recorded, not corrected; below 500 ms nothing is shown. A camera more than 2 s behind may leave up to 1 s of wrongly timed video before it is given up. Whether the sealed package marks such a track beyond the fault row in the audit extract is not established | D188, D190, D194 (C1, C3) |
| 5 | Power loss, a volume that really runs out of space, and a volume without hard links are not proven by any test; the write-failure path was proven with an injected fault only | D127, D194 |
| 6 | The fragment size bound was proven at a small bound (2 MiB), not at the product's 64 MiB | D188, D194 |
| 7 | The audit extract inside a package is not covered by the package signature; a hash field for it is proposed for the next manifest revision. Audio lost across a restart of the capture worker IS stated under the signature: the package of a session that had such a restart carries `audio.absentOnRestart` in `session-manifest.json` - one record per restart with the earlier and the later attempt number and the measured least and most length of the gap in milliseconds (null where a bound was not measured) - and its `audio.sourceIntervals` hold the replaced worker's interval with the span 0..0. The package of a session without a restart carries no such member and is byte for byte what it was before. What ONLY the unsigned extract says: the microphone, the instant of the restart and the wording of the entry (`CAPTURE_AUDIO_ABSENT_ON_RESTART`), and every other record of lost audio (a microphone lost while its worker ran, the switches). Two things stay as they were: `timeline.recordingDurationMs` of a restarted session spans the session and is longer than `tracks[].durationMs` (the member states the audio gap, not the instant the recorded media begins); and a verifier older than the fourth contract step refuses a package that carries the member (strict manifest) - only packages of a restarted session carry it. Rewritten 2026-10-14; verify reports the member as the notice `AUDIO_ABSENT_ON_RESTART`. The same holds for a camera absent inside a session (`tracks[].absentInSession[]`, notice `VIDEO_ABSENT_IN_SESSION`): block **Task 4** | D182, D183; C73, C83, C108 |
| 8 | Transcript model provenance of a server backend is the server's reported name only; nothing of it is verified by the Core | D160 |
| 9 | A committed transcript revision whose staged file is lost before the next start cannot be healed | D187 |
| 10 | A sealed-package item shows its development-key mark only after a verification, not on the item detail before one | D183 |
| 11 | The manifest states the session record as it was when the manifest was first built; a seal resumed after an upgrade keeps the earlier software version and names | D178 |
| 12 | The local microphone delivers about 8/9 of its declared rate (cause not established) and is not fit for recording. The local camera is a variable-rate source: the fixed-grid playback check does not apply to it | D128, D136 |
| 13 | Composite video export is not available: no encoder is selected until the licence decision on the FFmpeg build is taken. The generated test camera and the demo seed name `libx264` and therefore need a GPL build of the helper | D139, D141, D185 |
| 14 | An export leaves a decrypted archive on the Core's disk. The download link lives 60 s; a download already running is not cut when it expires, it is cut when the sign-in ends. Playback uses a 60 s media session that the player renews on demand; whether a real player on a device fails during plain playback past 60 s has not been judged | D139, D140, D149, D185 |
| 15 | Real network cameras and real microphones are proven on doubles and generated sources only. Corrected 2026-10-11: the local speech engine HAS transcribed a product session that was then sealed with an assembled transcript, on synthetic speech (D211; `gateway_check/11b_m6_regate.md`). No real voice has been through it; the server speech backend has never been driven live | D176, D194, D211, D221 |
| 16 | Biometric sign-in is not gate-tested in this task: the biometric steps were skipped on the user's instruction | D151 |
| 17 | The S7 and S8 cells of the kill matrix (10 cells) are parked on open decision OD-21 and were not run | D155, D172 |
| 18 | In Simulated mode the list of audio-source intervals falls back to one boundary per switch pair once the session's timeline holds more than 200 items | D182 |
| 19 | A Core that dies before the first telemetry of a restarted worker reopens the audio tap as "never lost" | D180 |
| 20 | Two capture faults with different reasons and no device are one alert entry; a system notice raised by a Core that then dies stays active after the restart; some refusals of the capture supervisor raise a fault without a reason | D169, D190, D194 (C4) |
| 21 | A worker binary of the previous version passes the boot checks and fails only at the first session start (it fails closed: nothing is recorded) | D194 (C7) |
| 22 | A replaced camera-credential envelope is not cleaned up by the running Core | D181 |
| 23 | The GCM nonce of a fragment is random: uniqueness under one session key is probabilistic, not proven. Destroying a session key is not built | D147, D189 |
| 24 | Speaker labels are "unavailable" in every sealed transcript of this build: the running Core composes no speaker-labelling engine. The two segmentation models that were downloaded are not cleared for use (see `THIRD_PARTY_NOTICES.md`) | D90, D157 |
| 25 | Rewritten 2026-10-14 (it said that no command provisions a production signing key). A production signing key is made by `npm run evidence:production-key -w @dems/core-server -- --data-dir <dir>`. What it gives is a software Ed25519 key in files of the host, readable by the account the Core runs as, with a self-signed certificate: no hardware key store, no certificate authority, names typed by the installer, the signer's own clock, no revocation channel. The command has not been run on a host | D138; U19, U20, C54 |
| 26 | Personal data in real evidence: no consent or legal-basis statement, no retention or erasure rule and no impact assessment exist (SEC35-26). **Open: the user's decision.** Corrected 2026-10-11: this row said "accepted risk"; no recorded decision of the user accepts it | security review row 35; D241 |
| 27 | A Core that dies in the first moments of a recording, between the worker's first durable fragment and its database row, restarts showing "nothing was recorded" for that session until the start-up seal turns it into an interrupted recording. Nothing is lost; the sentence is wrong for that time | D187 (R74-14) |
| 28 | On the server backend a transcript that is partial because the server had not finished its backlog when the seal stopped waiting is signed with the cause "backend could not be reached". The lost text is reported correctly; the stated cause can be wrong, permanently | D187 (R80-05) |
| 29 | The folder of an unsealed development-source session blocks every reset of its database until it is sealed or removed by hand. Session keys of development packages that a reset removes are not destroyed (those of the reseeded demo packages are) | D189 (R88-10, R88-12) |
| 30 | Rewritten 2026-10-14 (it said that a retained set of earlier certificates is not built). Rotation IS built: `evidence:rotate-key` and `evidence:mark-compromised` (block **Task 4**). The Core's verify and its export trust every certificate retained in `<data directory>/signer` that parses and verifies itself; a development-marked certificate is never trusted by a production Core, and a key that was never active is not trusted. What remains: the Core must be restarted after a rotation before it signs again (`ACTIVE_KEY_CHANGED`); the two commands write no audit row - the next boot's `SYSTEM_BOOT` row records the change; a retired key's private half stays on the host; a receiver has no certificate of an earlier key unless its fingerprint was handed over (Known limit 54) | D189 (R88-14); C69, C77, C84, C91, U21 |
| 31 | The manifest's clock-offset field cannot say "not measured": when the worker measured no offset the field holds a fallback value | D189 (R88-16), D190 |
| 32 | The first group of pictures of a camera is not written at every start (specified behaviour; about one second on the test cameras, up to the camera's keyframe interval). The skipped span is reported by the worker and has no field in the sealed manifest | D142, D157 |
| 33 | A recording whose two microphones both fail is not ended: video may be durable, and named warnings are raised. The switch boundary of the audio source lies a few tens of milliseconds before the instant of the command; the interval record states the exact boundary | D142, D163 |
| 34 | **Rewritten 2026-10-14 to the built command. The published demo password is the password of every operator of a SEEDED database, in every capture operation, until it is replaced from the host: `npm run operator:set-password -w @dems/core-server -- --database <name> --data-dir <dir> (--username <u> \| --all-demo)`, with the Core stopped, each operator typing their own (block Task 4). A `REAL_PRODUCTION` Core refuses to start while an operator still has it.** The command is the only password change the product has: there is none in the web console or the apps, every change needs the host and a stopped Core, and a `db:seed` or `db:reset` afterwards writes the demo password again. The text that follows is the row as written on 2026-10-11, kept for its sources; its sentences "no password-change path" and "cannot be brought up from the seed at all" are corrected by this paragraph and by the end of the row. The seed writes it for all operators (`apps/core-server/src/db/seed/seed.ts:239`), both sign-in cards print it and fill it in (`apps/core-web/src/features/login/auth-card.tsx:499`, `apps/mobile/src/features/login/login-card.tsx:549,566`), and there is no password-change operation - so any process on this Mac can sign in as Supervisor on the development-capture lane and play or export what was recorded there. BUILT in the tree of batch N (`713d83f` plus batch N, uncommitted at the time of writing; security finding S99-01, HIGH; `implementation/164_batch_n_chain_fixes.md` section 1): a `REAL_PRODUCTION` Core refuses to start (`CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION`, see **What refuses to start**) while an operator's stored credential still verifies against the demo password, and also when the operators cannot be read (`OPERATORS_UNREADABLE`). It has tests and no gate. WHAT REMAINS: `db:seed` and `db:reset` still accept a production environment and write the dataset, demo password included (`apps/core-server/src/db/seed/demo-core.ts:14-17`; S99-01 (b)); there is no operator-provisioning and no password-change path (S99-01 (c), a task of its own); the two sign-in cards still print the demo password, because no Core-stated fact about the capture operation reaches a signed-out client (`packages/shared/src/api/health.ts:35-47` states none; R101-01, next task). So a seeded database is not a production database. STATE 2026-10-14: with `operator:set-password` and `evidence:production-key` a production Core starts on a seeded database for a BENCH TEST only; still not built are an operation that creates operators, a production seed without the demo persons and data, a signed-in password change, and sign-in cards without the demo password (gaps G1 to G4, lists A and B of block **Task 4**). The file line numbers in this row are those of 2026-10-11 and were not read again | D241; U19, U20, C64, C66, C71 |
| 35 | The confirmation before this Mac's camera or microphone is opened is enforced by the three clients only; the Core opens the device for any caller with the session-start permission (S99-02). Open: the user's decision | D163, D241 |
| 36 | A finished export archive is a DECRYPTED copy that stays in the package folder until a reset removes the package; no retention rule exists (S99-03). Open: the user's decision | D139, D205, D241 |
| 37 | No key escrow: losing `<data directory>/credential-store` makes every sealed recording unreadable (SEC35-09). Open: the user's decision. Added 2026-10-14: this limit is about the SESSION keys only and is not changed by the production key command; the signing key in `<data directory>/signer` is a different key with the opposite risk (a copy, not a loss) and is Known limit 47 - the table "Two keys, opposite risks" of block **Task 4** keeps them apart | D241; U20 (6) |
| 38 | No manifest member states the frames a camera DELIVERED: `tracks[].profile` is the format the stream declares. A camera that delivers fewer pictures than its nominal rate seals with the nominal label and no notice | D226 |
| 39 | The time source of a recording is the bare word `RTC` on the audit row and on the evidence item; only the manifest pairs it with `HOST_SYSTEM_CLOCK`. The tablet's summary of a past session reads it through the Core's current state | D235 (G89d-01); code review R101-09 |
| 40 | The tablet and the phone log library mount warnings (`synchronouslyUpdateUIProps failed`): a layout event of the vector-drawing library meets the animation library's registry. No native patch is applied in this build; the three-line patch is listed for the release-build session | D224 (2) |
| 41 | An acknowledgement of the unsealable notice by a role that cannot close it writes no audit row; a 68th audit type is needed | D237 (G75e-07) |
| 42 | The web console's tamper tile counts from the newest 1,000 audit rows (GM-02), and its Session New cuts the notification of an unreachable camera at 1440 x 900 (GM-01). Both open | D239 |
| 43 | The model, firmware and port values of the simulator's dataset are still stored and sent for the generated sources; each screen hides them. The New Session label "Standard (1080p / 25 fps)" and the member behind it are simulator values; the pre-check rows say "READY" beside "Not checked"; no Core states when it last checked a source | D224 (5), D231, D217 (6) |
| 44 | Smaller security limits of the final review. All were open at `713d83f`. BUILT since, in the tree of batch N (uncommitted at the time of writing; tests, no gate; `implementation/164_batch_n_chain_fixes.md`): S99-04 - the shared log-blanking rule blanks the userinfo of a URL that carries a password, `rtsp://user:password@host` is kept as `rtsp://***@host` (`packages/shared/src/api/redaction.ts:83`, `:249`; a password with a raw `/` is not covered, a userinfo without a password is not blanked); S99-07 - `.gitignore` ignores `*.p8`, `*.wrap` and `*.blob` by form (`.gitignore:102-104`; no tracked file has one of the extensions); S99-09 - a body of operation 91 (`updateSttConfig`) that carries `credential` is refused `403 NOT_PERMITTED` (`WEB_CONSOLE_ONLY`) from a tablet or phone session (`apps/core-server/src/modules/stt-config/index.ts:309`); the operation's access member is unchanged and a save without a credential still works from a device. STILL OPEN: the key of a replaced camera credential is never destroyed (S99-05; see limit 22), the signer's private-file read is weaker than the key store's (S99-06), the capture worker loads its FFmpeg libraries from the package manager's folder (S99-08). S99-05, -06 and -08 are carried to the next task | D241 |
| 45 | `npm test` does not run the database suite, the three scenario suites that drive the built capture worker, or the capture worker's own checks (see **Tests**) | D241 (R101-05) |
| 46 | A production boot from this repository is a BENCH boot on the seeded database. No operation creates operators: the accounts are the three demonstration persons of the seed, and the demonstration cases and evidence stand in the same register and audit chain as anything recorded. No real examination is recorded on such an installation until list A of block **Task 4** is closed | U20 (5) |
| 47 | The signing key is a software key in files of the host: no hardware key store, and no escrow (a lost key is replaced by a rotation; a copy of it cannot be taken back). The host account of the user the Core runs as has full control of every operator account, of the audit log and of this key. The certificate is self-signed, with names the installer typed, the signer's own clock and no revocation channel. To be decided before a real installation | U20 (6); security review SX-20 |
| 48 | On Linux the Core does not read the firewall rule's TABLE. An unprivileged process without capabilities cannot list it, so the start check reads the state of the rule's UNIT only: a table deleted by hand while its unit is active is not noticed by the Core. Giving the Core the capability to read the table would also let it change the table and is ruled out. Measured in a container; a real host has not been asked | C103 |
| 49 | "The Core is stopped" is known to `operator:set-password` from database connections only. The Core holds no lock and writes no process file; the command sees connections, not a process, and a test that sees none is not proof that no Core runs. The key commands open no database and cannot see a Core at all. Stopping the Core first is the installer's own act. A lock the Core itself holds is to be built before any real examination | C71 (C-8) |
| 50 | The boot checks of the key and the operators are necessary conditions, not proof of correct provisioning. The directories ABOVE the data directory are checked once, by `evidence:production-key` at provisioning, and are not asked again each time the Core loads the key: keeping them owned by root or the Core's user and not writable by others is a standing requirement of the installation | C54 (4), C71 (C-5) |
| 51 | Two sound cards of the same model WITHOUT serial numbers, swapped on the same USB socket, cannot be told apart by the Core. A card with a serial is found on any port; a card without one that moved is `CARD_CHANGED` until it is registered again. The serial path and port stability across a reboot are unproven on real hardware | C56 |
| 52 | A dual-lens camera that offers two streams as ONE device cannot be recorded on both video tracks: the same device on both video slots is refused at assignment in real capture (`CAMERA_ON_BOTH_TRACKS`). Whether DEMS must record both lenses of one device is an open scope question, not built | C93 |
| 53 | The commissioning scan does not count the devices that answer on one factory address: `deviceCount` says `NOT_KNOWN` when it cannot. The procedure "one factory-address camera connected at a time" with the hardware-address binding of the address change suffices for a bench only; the count is to be built before a real installation | C94 (a), C105 |
| 54 | A receiver of an export learns that a signing key was marked compromised only from a list of fingerprints sent to them out of band (`evidence:verify-export ... --compromised <sha256>`). No package can say it of itself, there is no revocation channel, and an export delivered before the mark states nothing | C84 (R-2), C91 |
| 55 | After a camera stream was lost and opened again, the relay accepts the stream only when its parameter sets come back byte-identical; otherwise that camera's capture ends (relay code `STREAM_INVALID`). A camera that restarts with other encoder settings inside a session is therefore not recorded on | `implementation/043_relay_reconnect_gating.md` of the task folder |
| 56 | The size limits of a camera's ONVIF answers (16, 64 and 128 KiB by kind of answer) were fitted to the answers of the fake camera of the tests. The size of a real camera's answers is not known here: a real camera with a large profile list could be refused. The Core's log names a reply refused by size | C100 |
| 57 | A production Core on a Mac is not held to the Linux host profile; each of its packages says so (`hostProfileNotAsked`). The address helper and the commissioning functions exist on Linux only, and the helper is not released for an installation before its check on a real host has passed | U21 (2), C97, C94 (j), C101 |
| 58 | No session with a production camera has been recorded and sealed. A camera's absence inside a session as a signed fact (`tracks[].absentInSession[]`) was shown with the relay's reports supplied by the test, not with the built relay inside a session | C108 |

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

Correction (2026-10-11): at commit `713d83f` the whole regression is green in one run on a quiet host (`docs/2026-10-07_dems_real_capture_sealing/test/17_row100_final_test_report.md` Part A): shared 2614, capture-protocol 31, core-server unit 6702, core-server database 2423 (7 skipped), core-web 2224, mobile 2917, transcriber 564 (3 skipped), mock-core 19; `scripts/pg` 57; the seal end-to-end 3, the development-session end-to-end 2 (2 skipped: the speech case and the user-attended case), the kill matrix 35 of 35. The per-wave test files that earlier notes name no longer exist: they were merged into the feature folders of their subjects (`test/14_consolidation_*.md` of the same folder hold the map old name to new home).

Correction (2026-10-14): the counts above are those of the third task. On branch `task4/input-av-core-port` the full suite has not been run since `713d83f`: commit `1fbeada7` is a checkpoint on which only typecheck, lint and the static rule sets ran (decision U26 of `docs/2026-10-12_input_av_core_adapter_plan/decisions/decisions.md`; block **Task 4**). The test counts of the fourth task are TO BE REFRESHED AFTER THE FINAL FULL SUITE; no count is given here until it has run. The contract has grown since `713d83f` (97 operations, 67 audit types, schema 6 there): 110 operations and 83 audit types at `1fbeada7` (`docs/2026-10-12_input_av_core_adapter_plan/delegation_progress/wave_12_brief.md`), the schema version moving with the uncommitted steps of the branch.

**What `npm test` does not run.** `npm test` runs the unit suites only. It does not run the database suite (`npm run test:db`), the three scenario suites that drive the built capture worker, or the capture worker's own checks. These root scripts run them (root `package.json:53-58`; `scripts/test/regression.sh`, `scripts/test/kill-matrix.sh`); each is run from the repository root, and those that bind loopback ports or use the project PostgreSQL need the command sandbox off:

| Script | What it runs | Needs, and about how long |
|---|---|---|
| `npm run test:seal-e2e` | The seal end to end: the built capture worker records, the Core seals, verify checks (3 tests) | the built worker, `npm run capture:dev-setup`, PostgreSQL running; about 1 minute |
| `npm run test:dev-session-e2e` | A development session on generated sources: start, durable, stop, seal. No device is opened: the script unsets the two attendance variables | as above; under half a minute |
| `npm run test:kill-matrix` | Every active cell of the kill matrix (35), once; the 10 parked cells are not started | as above; about 10 minutes |
| `npm run test:capture-worker` | `make -C apps/capture-worker`: the static rules of the C sources, their self-test, the C unit tests, the build | the C toolchain, `pkg-config`, the FFmpeg libraries already on the host; under a minute |
| `npm run test:capture-worker-e2e` | `make -C apps/capture-worker e2e`: the worker's end-to-end series on generated fixtures | two free loopback ports; about 35 minutes |
| `npm run test:regression` | Everything, strictly one step after another, stopping at the first failure: typecheck, lint, the eight suites, `scripts/pg`, the worker checks, the three scenario suites, the worker series (16 steps). `DEMS_REGRESSION_SKIP_WORKER_E2E=1` leaves the last step out and says so | everything above; about 75 minutes |

None of them opens a camera or a microphone, and none runs the real-engine transcriber tests. They were added on 2026-10-11; when this was written the three scenario scripts, the worker series and `test:regression` had not yet been run THROUGH these scripts (their commands are the ones the final test report ran by hand), and `test:capture-worker` had been run once by its author, with exit status 0 (`docs/2026-10-07_dems_real_capture_sealing/implementation/164_batch_n_chain_fixes.md` section 6; script names and purposes in `delegation_progress/contract_batch_n.md`). Of the six, only that one has been run.

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
- The APK is signed with a **DEMO keystore** in the git-ignored `apps/mobile/signing/` (random password, never printed). It is Simulated-only: Heartbeat is disabled in release builds. Correction (2026-11-06, branch `audit/fix-20261105`): the release APK is now Live-only (decision D163), with biometric sign-in off (R174-G5) and cleartext permitted to the configured LAN Core (D263, residual R263-TLS); see **Tablet app** in the Overview.
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
| Live app: Start Session stays on "Checking your permissions…" | The app has not received its first state from the Core, so the operator's role is not known yet (the link is down or still connecting). The screen has no button and no time limit by design: it continues by itself once the role is known. To leave before that, use the system back button or the back gesture, then check the Core link (the row above) |
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
