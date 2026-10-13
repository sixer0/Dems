---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 232
package: M12 (user-attended milestone; U18, P11 (2), C29)
date: 2026-10-13
agent: test-expert (batch 9, agent R14)
status: needs-review
tier: T2
---

# Row 232 - a Core of this branch for the user's camera search and connection test

Status `needs-review`: the instance is RUNNING and answers; nothing was probed, signed in to, recorded, adopted or re-addressed. It is `needs-review` and not `complete` because four points differ from the row's cells and need the controller's word (section 6, DRIVER DECISIONS 1 to 4).

## UNTUK PENGGUNA

Instance ini hanya untuk MENCARI kamera dan MENGUJI KONEKSI. Tidak ada yang direkam.

Catatan jujur: nama tombol dan kalimat di bawah diambil dari kode konsol (teks bahasa Inggris, satu-satunya bahasa konsol). Agen tidak membuka layar dan tidak masuk, jadi letak persisnya di halaman belum dilihat oleh agen.

1. Buka di browser Mac ini: **http://127.0.0.1:5178** (ketik `127.0.0.1`, jangan `localhost` - dengan `localhost` konsol menolak mode Live).
2. Masuk sebagai operator demo dengan peran **Technician** (Rina Wijaya); peran Supervisor juga bisa. Nama pengguna dan kata sandi demo ada di tabel "Demo credentials" di `README.md` bagian "Quick start for presenters" (baris 41 dan seterusnya), dan di layar Login pada bagian "Demo operators". Peran Investigator tidak punya izin mencari kamera.
3. Buka halaman **Devices** (menu samping). Di panel **Camera Search**, tekan tombol **Search for cameras**. Pencarian memakan beberapa detik dan tidak menyambung ke kamera mana pun: ia hanya bertanya ke jaringan "kamera mana yang ada". Yang ditanya adalah antarmuka jaringan Mac ini: **en0** dan **en5** (lihat bagian 4).
4. Kamera yang menjawab muncul di daftar "Cameras found". Merek, model dan nama adalah apa yang diumumkan kamera itu sendiri; belum diperiksa.
5. Pada baris kamera Anda, tekan **Connect**. Ini hanya MEMBUKA dialog; belum ada yang disimpan.
6. Di dialog itu, ketik **nama pengguna dan kata sandi milik kamera** (yang diatur di kamera itu, bukan akun demo). Ketik HANYA di dialog konsol web ini - jangan di terminal, jangan di chat, jangan di berkas. Centang "I have checked that ... is this camera", lalu tekan **Test connection** (sampai kira-kira 15 detik).
7. Arti hasilnya:
   - **"Connection works. This camera can be added."** dengan "N usable video profile(s)": kamera menjawab, menerima kata sandi, dan Core berhasil membaca aliran videonya (H.264 atau HEVC, dinilai dari aliran itu sendiri, bukan dari apa yang diumumkan kamera). Layar hanya menampilkan JUMLAH profil; kode profil dan codec tidak ditampilkan di layar (lihat bagian 5, temuan untuk baris 233).
   - **"The camera refused this user name or password."**: autentikasi gagal. Periksa ejaan. Perhatian: setelah beberapa kali ditolak, pengujian kamera itu dijeda supaya akun kamera tidak terkunci; layar menyebut sisa percobaan.
   - **"This camera only accepts a sign-in method that this system does not use. The password was not sent."**: kamera hanya menawarkan cara masuk "Basic". Sistem ini hanya memakai "Digest". Kata sandi TIDAK dikirim. Mengetik ulang tidak membantu; pengaturan autentikasi di kamera yang harus diubah.
   - **"...none of its video profiles delivers H.264 or HEVC."**: aliran videonya bukan H.264 dan bukan HEVC (misalnya MJPEG). Ubah pengaturan video di kamera.
   - **"The camera did not answer."**: tidak terjangkau - daya, kabel, atau aliran video tidak terbuka dalam batas waktu.
   - **"...it offers no video profile this system can use."**: kamera menjawab, tetapi alamat aliran yang ia berikan ditolak atau tidak ditemukan (termasuk bila bentuk alamat aliran tidak diterima sistem, misalnya membawa bagian yang tidak diizinkan).
8. JANGAN ditekan, kecuali Anda sendiri memutuskan lain:
   - **Add as camera** (muncul setelah tes berhasil): ini MENDAFTARKAN kamera dan menyimpan kata sandinya. Tutup dialog dengan Cancel / tanda silang.
   - Apa pun di halaman **Session** (New Session, Start): instance ini bisa merekam dari sumber uji dan dari kamera/mikrofon Mac ini; itu bukan bagian dari uji ini.
   - Pengaturan slot kamera/mikrofon di halaman Devices.
9. Yang BELUM bisa, dan sebabnya:
   - **Mengetik alamat kamera** ("A camera that does not answer the search" -> "Search this address"): akan ditolak dengan "The Core does not ask this address... Nothing was sent." Core hanya mau bertanya ke alamat di jaringan kamera yang sudah dikonfigurasi (antarmuka dan subnet kamera), dan versi ini belum membaca konfigurasi itu, jadi setiap alamat yang diketik ditolak tanpa mengirim apa pun (`implementation/096_typed_address_probe.md`). Ini memang diharapkan. Pencarian biasa (langkah 3) tetap bekerja.
   - **Mikrofon USB**: jalur mikrofon produksi memakai ALSA di Linux. Di macOS mikrofon USB tidak bisa lewat jalur itu, jadi tidak ada yang diuji untuk mikrofon di sini.
10. Selesai? Beri tahu saja. Instance dibiarkan hidup; menghentikannya adalah baris 235 (perintahnya di bagian 3).

Bila kamera tidak muncul: pastikan kamera menyala dan berada di jaringan yang sama dengan en0, atau tersambung langsung ke adaptor en5; lalu tekan "Search again".

## 1. What was started, and why this capture operation

**Capture operation: `REAL_DEVELOPMENT`** (`DEMS_CAPTURE_MODE=real`, `DEMS_CAPTURE_DEV_SOURCES=1`), through the product's app factory, no camera stub, no test support. Read from the code of commit `0f5d2a8e`:

| Question | Answer | Source |
|---|---|---|
| Does the search of a development Core go to the real network | yes: the product's ONVIF discovery adapter exists whenever the capture mode is `real`; the loopback stub is only what `provideAdapter` hands in, and nothing hands one in here | `apps/core-server/src/modules/capture-discovery/index.ts:155-158` |
| Is a candidate from the real network offered for a connection test in this operation | yes: the test path has no gate on the capture operation; the only class rule is that a non-development candidate needs a credential (`CREDENTIAL_REQUIRED`) | `modules/capture-discovery/connect/service.ts:295`; no `REAL_PRODUCTION` test in `connect/service.ts`, `capture/adapters/production-door.ts`, `camera/stream-probe.ts`, `camera/relay-start.ts` (searched, 0 matches) |
| Does the stream half run | yes, when the test has a credential and `captureRelayPath` is set; it is set (section 2) | `modules/capture-discovery/index.ts:279-284`; `implementation/050_stream_test.md` section 4 |
| Is the listener kept on loopback | yes: the host is the constant `127.0.0.1`; the development flag with any other listener is refused (`DEV_FLAG_WITH_LAN_LISTENER`) | `apps/core-server/src/config.ts:41`; `capture/fence/operation.ts:76` |
| Why not `REAL_PRODUCTION` | it refuses to start with a development signing key and with seeded demo passwords, and no production key exists | `README.md` "What refuses to start"; "The signing key" |
| Can this instance record | it CAN (generated test sources, and this Mac's camera and microphone as development sources, registered at boot as `CAM-03`, `MIC-03`); nothing was started. It is prevented by not pressing, not by the code. A production camera cannot be recorded here: an assigned production source in this operation is refused (`DEV_FLAG_WITH_PRODUCTION_SOURCE`) | boot log line `capture fence passed`; `README.md` table of refusals |

**The tree is commit `0f5d2a8ede541bb08b05ad7d4c79a6c09953d5a6`, not the working tree.** Its `apps/core-server`, `apps/core-web`, `packages/` and `tsconfig.base.json` were exported with `git archive` to `.cache/task4-row232/tree/` (84 MB of sources; read-only use of git). Reason: thirteen agents edit the working tree in this batch - at 10:48 `git status` already showed changes in `apps/core-server/src/capture/boot/index.ts`, `src/db/schema/`, the migrations journal and others - and a Vite dev server on the working tree would hot-reload their half-finished edits into the user's page. Dependencies resolve upward to the repository's `node_modules`; the workspace packages resolve to the export through four links in `tree/node_modules/@dems/`; three nested packages are linked (`xml2js`, `xmlbuilder`, `@hookform`). The commit holds rows 42, 50 and 51 (commit message of `0f5d2a8e`: "stream-level connection test"; `3b388746`: "relay candidate with hardened RTSP client").

## 2. How it was made (commands, from the repository root, command sandbox off)

| Step | Command | Result line |
|---|---|---|
| Export | `git archive 0f5d2a8e apps/core-server apps/core-web packages tsconfig.base.json \| tar -x -C .cache/task4-row232/tree` | 84M |
| Database | `/usr/bin/lockf -k -t 900 .locks/db-migrate.lock sh -c 'cd .cache/task4-row232/tree/apps/core-server && tsx ../../../db-setup.mts'` - the commit's own `runCreate`, `runMigrate`, `runSeed`, `runStatus` with the name guard's test seam | `db:status: OK: dems_test_m12_row232 is at the schema version this code expects and the ledger matches the files.` (schema version 8, dbc-9; 19 migrations; 3 operators; `capture_devices 5`; `capture_device_credentials 0`) |
| Directories | `mkdir`, `chmod 700`: `data/`, `media/sessions/`, `logs/`, `run/` | all `drwx------` |
| Development key | `tsx src/sealing/dev-key-cli.ts --data-dir .cache/task4-row232/data` (the script behind `npm run evidence:dev-key`) | `evidence:dev-key: OK, a DEVELOPMENT signing key was provisioned (not for production)` |
| Transcriber host file | copied from `.data/transcriber/host.json` (a configuration of program paths, no secret); the seeded transcription configuration needs it at a real boot | boot log `TRANSCRIBER_RESOLVED` |
| Core | `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock sh .cache/task4-row232/start.sh core` (lock held about 4 s) | `row232: the Core is ready on 127.0.0.1:4423 (PID 57178)` |
| Web console | `sh .cache/task4-row232/start.sh web` | `row232: the web console answers on http://127.0.0.1:5178 (PID 57305)` |

The environment of the Core, complete (set by `start.sh` after clearing the capture family, as `scripts/lane/lane.sh` does): `DEMS_CORE_PORT=4423`, `DEMS_CAPTURE_MODE=real`, `DEMS_CAPTURE_DEV_SOURCES=1`, `DEMS_MEDIA_DIR=<row directory>/media/sessions`, `DEMS_CAPTURE_HELPER_FFMPEG=.data/helpers/ffmpeg`, `DEMS_CAPTURE_WORKER`, `DEMS_CAPTURE_RELAY`, `DEMS_CAPTURE_GUARD` = `apps/capture-worker/build/capture-worker`, `capture-relay`, `capture-guard` (absolute paths). Demo controls unset. The web console: `DEMS_CORE_PROXY_PORT=4423 VITE_DEMS_CORE_MODE=live`, `vite --host 127.0.0.1 --port 5178 --strictPort`.

The built programs were used as they are; nothing under `apps/capture-worker` was rebuilt. Their SHA-256 at the start (10:46), so that row 233 can tell whether row 193 rebuilt them under the running instance:

| Program | Built | SHA-256 |
|---|---|---|
| `capture-relay` | 10:15 | `815725e3b054c52616916c792d79ccbbc283dc14ba064f44c51065d7ac444837` |
| `capture-guard` | 10:15 | `6da6c5821890b05f7058665dc841b0d371cbbd6edb1316229e9f68d40ac5f0ca` |
| `capture-worker` | 10:14 | `fe6bda4e4cf4fb79a726165392e7d7b80c89e42e5af76a739c8a664a7b2a00ba` |

They are built from the UNCOMMITTED worker source of row 193 (in flight), not from the commit: the Core and the console are the commit, the three C programs are the working tree's build.

## 3. Facts for rows 233 to 235

| Fact | Value |
|---|---|
| Web console (the user opens this) | `http://127.0.0.1:5178` |
| Core | `http://127.0.0.1:4423` (health: `/api/v1/health`) |
| Process IDs | Core `57178` (`node --import tsx .../launch.mts`; its shell wrapper `57176`); web console `57305` (`node .../vite.js`; wrapper `57303`). Both detached with `nohup ... &` in a sub-shell, parent 1, no terminal; started 10:46:51 and 10:47:00 WIB |
| Pid files | `.cache/task4-row232/run/core.pid`, `.cache/task4-row232/run/vite.pid` |
| Database | `dems_test_m12_row232` on the project's PostgreSQL (127.0.0.1:4432), owner `dems_owner`, schema version 8 (dbc-9). The name does not match the test helper's run scheme, so the helper's stale sweep lists it as unrecognised and does not drop it (`apps/core-server/test/helpers/db/names.ts:41`, `:229-256`) |
| Data directory | `.cache/task4-row232/data/` (0700): `signer/` (development key), `transcriber/host.json`; the Core writes its camera-credential store and its boot probe log here |
| Media store root | `.cache/task4-row232/media/sessions/` (0700), empty |
| Logs | Core: `.cache/task4-row232/logs/core.log` (JSON lines); persistent error log: `.cache/task4-row232/logs/errors.log` (absent until an error); web console: `.cache/task4-row232/logs/vite.log`; listings: `logs/before.txt`, `logs/after.txt` |
| Scripts (git-ignored fixtures) | `launch.mts`, `start.sh`, `stop.sh`, `db-setup.mts`, `db-list.mts` in `.cache/task4-row232/` |

**Stop (row 235), command sandbox off:**

```sh
sh /Users/gsp-budi/Documents/DEMS/.cache/task4-row232/stop.sh
```

It sends TERM to the listener of 5178 and then of 4423, each only if its working directory is inside `.cache/task4-row232/tree/`, waits up to 20 s for each port, and deletes nothing. By hand, the same: `kill -TERM 57305; kill -TERM 57178` (the wrappers 57303 and 57176 end with them). The script was parsed (`sh -n`) and its ownership test was run against both processes; it was NOT run to the end, because that stops the instance.

**Start again** (same database and directories): `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock sh .cache/task4-row232/start.sh core`, then `sh .cache/task4-row232/start.sh web`.

**Do not use `scripts/lane/lane.sh` on lane 3 while this runs.** The instance holds lane 3's port: `lane.sh status` reports "lane 3 ... dems_lane_3 ... RUNNING (PID 57178)", which is wrong about the database, and `lane.sh stop 3` would stop this Core.

**Kept for the controller (row 235 lists, the controller removes after row 234):** the database `dems_test_m12_row232` (12.3 MB) and `.cache/task4-row232/` (133 MB, of which the export 133 MB with Vite's dependency cache). Dropping the database needs the test helper's or the owner's door: the `db:*` commands refuse the name.

## 4. Which interfaces the search probes

The search sends a WS-Discovery probe to the multicast group `239.255.255.250:3702` with TTL 1, once per eligible interface and again 250 ms later (`capture/adapters/camera/ws-discovery.ts:9-13`, `:69`). Eligible, by property and never by name: IPv4, not internal, a netmask that is neither a host mask nor zero, a hardware address that is not all zero, at most four (`capture/adapters/camera/discovery-collector.ts:59-80`, `DISCOVERY_MAX_INTERFACES = 4`).

Read at 10:44 with that rule over `os.networkInterfaces()` (names only; no probe sent):

| Interface | Kind |
|---|---|
| `en0` | routable IPv4, prefix 24 |
| `en5` | link-local IPv4 (169.254/16), prefix 16 - link-local addresses are eligible by the rule |

Not probed: `lo0` (internal), `awdl0`, `llw0`, `utun0` to `utun6` (no IPv4 or no hardware address). The set is read anew at every search, so an interface that comes up later is included. An answer is accepted only from an IPv4 address on the segment of a probed interface (`discovery-collector.ts:100`).

## 5. Checks, and what they do not show

| Check | Command | Result |
|---|---|---|
| Health, direct | `curl -s http://127.0.0.1:4423/api/v1/health` | `HTTP 200`, `"status":"ok","service":"dems-core-server","version":"0.2.0",...,"ready":{"database":true,"engine":true}` |
| Health through the console's proxy | `curl -s http://127.0.0.1:5178/api/v1/health` | `HTTP 200`, the same body |
| Capture operation | `core.log` | `"code":"CAPTURE_FENCE_PASSED","operation":"REAL_DEVELOPMENT","registered":"CAM-03,MIC-03","local":"CAM-03,MIC-03","msg":"capture fence passed"` |
| Boot checks | `core.log` | `"code":"CAPTURE_BOOT_CHECKS_PASSED","operation":"REAL_DEVELOPMENT","checks":"real","workerVersion":"capture-worker/0.6.0"`; `"code":"CAPTURE_SUPERVISOR_BOOTED","mode":"real","worker":"configured"`; `Server listening at http://127.0.0.1:4423` |
| Console page | `curl http://127.0.0.1:5178/` | `HTTP 200 text/html 718 bytes` |
| Console modules | a walk of the import graph from `/src/main.tsx` through the dev server | `modules fetched through the web console server: 976 not 200: 0` |
| Console styles | the 19 arbitrary-value utility classes used only by `apps/core-web/src` looked up in the served `/src/index.css` (the export sits in a git-ignored folder, which Tailwind's source detection could have skipped) | `found in served CSS: 19 missing: none` |
| Listeners of the Core | `lsof -a -p 57178 -iTCP -sTCP:LISTEN`; `-iUDP` | `127.0.0.1:4423` only; UDP sockets 0 |
| Nothing was probed | routes and discovery codes in `core.log` | 3 requests, all `/api/v1/health`; lines with a discovery or connection-test code: 0 |
| User's lanes and databases | `logs/before.txt` (10:45:05) against `logs/after.txt` (10:48:46) | 4421 PID 75122, 4422 PID 75202, 5176 PID 75324, 5177 PID 75342: the same before and after; 4420 and 5173 free before and after. `dems_demo` 11,507,391 bytes and `dems_lane_3` 11,458,239 bytes unchanged, 0 connections; `dems_lane_1` and `dems_lane_2` exist before and after (their sizes grew by their own running Cores) |
| Secret forms | `node scripts/secret-scan/count-only.mjs` on `logs/` and the five scripts | `TOTAL: 0 in 0 file(s)` |

**Not shown, and why:**

- **"The relay program was accepted" has no boot log line in this operation.** `core.log` holds 0 lines with the word "relay". Host and program checks (steps 4d, 4e) are handed the relay path only when the composition hands in host facts (`capture/boot/index.ts:282-296`), which is the production start's matter (C46, row 85). What is verified: the path is in the environment, the file is a private executable (0755, owned by the user), and the configuration parser accepted it (an unusable value stops the start with `CAPTURE_PATH_NOT_ABSOLUTE`). The first real proof that the relay starts is the user's first connection test: a host fault would be the log code of `captureDiscovery.streamTest` with `RELAY_NOT_STARTED` or `RELAY_FAILED`.
- **No sign-in, no page render in a browser.** The module walk shows that every module is served, not that the page renders. No browser tool was used (U18: the first probe is the user's click).
- **No search and no connection test was run.** Whether the user's camera answers, and through which interface, is row 233.

**Finding for row 233, read from the code and not run:** the codec and profile code the STREAM states are not in any place row 233 may read. The operation's answer and the screen carry a count only (`usableProfileCount`, `packages/shared/src/api/capture-discovery.ts:334`); the log line of a test carries `outcome`, `testReason` and `judgedStreams` (a count; `connect/service.ts:378`); the profile codes stay in the candidate list in the Core's memory (`service.ts:345`) and reach the database only at adoption. So "the codec the STREAM states against the codec ONVIF states" is NOT OBSERVABLE for a camera that is tested and not adopted, unless the user decides to adopt it. The audit row of a test (`CAPTURE_CONNECTION_TESTED`) holds the outcome, the reason and the camera's host address: row 233's record must not copy that address.

## 6. Driver decisions (for the controller to confirm)

1. **A launcher instead of the product's entry file.** `apps/core-server/src/index.ts` takes the database from the listen port (`config.ts:139-141`: 4420 -> `dems_demo`, 442k -> `dems_lane_k`) and the data directory from the repository's `.data/` (`plugins/config/load-config.ts:49`); no variable changes either. With C29 that leaves no way to start this instance through `index.ts`. `.cache/task4-row232/launch.mts` is that file with TWO values replaced (database name, data directory): the same `buildApp`, the same loader for the environment and the runtime connection file (the connection values stay inside the product's `Secret`), the same start order and stop. The row's cell says "through the product's own entry point"; this is the nearest thing the code allows.
2. **Ports 4423 and 5178, not "outside 4420 to 4423".** Three closed lists of the commit make any other pair impossible without editing product code: the Core's listen ports (`config.ts:43`), the web console origins the Core accepts (`config.ts:92-97`: 5173, 5176, 5177, 5178) and the proxy targets of the console's dev server (`apps/core-web/vite.config.ts:9`). 5173 is forbidden, 5176 and 5177 are the user's; 4423 and 5178 were free (lane 3 is stopped, its database is at an old schema; row 12 did the same). So the row's check "the listeners of 4420 to 4423 are the same set before and after" holds for the user's listeners (4421, 4422) and differs by this row's own 4423.
3. **A database named `dems_test_m12_row232`, made by the commit's commands with the name guard's test seam.** The command line accepts only `dems_demo` and the three lane names (`db/commands/database-names.ts`). A clone of the test helper would be dropped by its run's teardown or by a later run's stale sweep after six hours; this name is neither. `db-list.mts` is one read-only catalog SELECT as the owner role, written for the before/after listing.
4. **The record's file name** follows the controller's brief (`test/232_real_device_instance.md`); the blueprint cell names `test/232_m12_instance_start.md`.

Rules kept: Edit tool only for the one existing file changed (`delegation_progress/file_claims.md`, one line); no product file, no test file of a workspace, nothing under `apps/capture-worker` touched or rebuilt; no commit; no full suite (no test suite at all: this row starts processes); no `db:migrate` on the demo or a lane database; no camera credential typed, read, received or logged; no probe sent to the network; no lane, emulator or other agent's process stopped.

---
*Generated: 2026-10-13 10:55 WIB*
