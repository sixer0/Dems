# DEMS Core as a Docker image (Ubuntu 24.04)

## Offline installer with LCD (2026-10-19)

The Linux Docker installer now includes the LCD service, Python and pyserial **inside the Core image**. It does not require a separate backend installation. Use `release/installers/DEMS-Linux-Docker-LCD-20261019-<amd64|arm64>-unverified.tar.gz` after exporting with `deploy/docker/build-installer.sh <arch> <smoke-tested-image>`.

Extract on the matching Linux host, run `./install.sh verify`, then `./install.sh install --lcd-device /dev/ttyACM0`. The installer imports both bundled images offline, creates a NEW demo installation, derives the USB group, sets the LCD URL and starts Core, console, PostgreSQL and LCD. `--without-lcd` explicitly postpones the physical panel. It refuses existing configuration/data; stop/start never removes volumes. Full instructions: `installer/INSTALL-ID.md`.

The `lcd` Compose profile uses UID 10001, the selected serial-device GID, a read-only media mount and loopback 8090. No USB device is exposed to the Core service. `DEMS_LCD_BACKEND_URL` controls the Core bridge. The added service is available in future full image builds; `build-image.sh` includes authorized, non-ignored new files in its explicit product paths so the LCD integration cannot be omitted simply because it is not committed yet.

The release remains a task-4 WIP: a Docker demo/bench package, not production hardware acceptance. Native Ubuntu production-host restrictions below remain in force. Do not call a successful container smoke test an ESP32 rendering test.


**Status: UNVERIFIED.** Built from branch `task4/input-av-core-port` at commit `6d6553e3` (a work-in-progress pause checkpoint, decision C155) plus one uncommitted typecheck fix in `apps/core-server/src/capture-composition.ts` (decision C156). On that tree only the TypeScript compile check ran (`tsc` 0 in every workspace). **No test suite was run.** The image is a package of that tree, not a release. Task record: `docs/2026-10-12_input_av_core_adapter_plan/implementation/dk_docker_image.md`.

## Ringkasan (Bahasa Indonesia)

Paket deployment DEMS Core untuk Linux dalam bentuk image Docker (Ubuntu 24.04, `linux/amd64`), dengan `compose.yaml` untuk PostgreSQL 18.4 dan Core. Status: **BELUM DIVERIFIKASI**. Hanya uji kompilasi TypeScript yang lulus; tidak ada suite uji yang dijalankan. Image ini tidak memuat kunci, kata sandi, kredensial, kunci penandatanganan, atau akun operator. Kata sandi basis data dibuat sendiri oleh operator di folder `secrets/`. Kunci penandatanganan produksi dibuat saat boot produksi pertama (`evidence:production-key`), sesuai `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md`. Semua layanan hanya mendengarkan di `127.0.0.1` (ketetapan kode Core). Konsol web dibuka di host itu sendiri pada `http://127.0.0.1:5173`, atau melalui tunnel SSH. Helper alamat (`scripts/host/netalias/`) adalah layanan root milik HOST dan tidak ada di dalam image. Sebuah container bukan host Linux yang diperkeras menurut profil host (HOST-21 melarang runtime container di host produksi). Karena itu operasi `REAL_PRODUCTION` di dalam container akan ditolak oleh pemeriksaan host milik Core.

## What is in the image

| Path in the image | What | Source |
|---|---|---|
| `/opt/dems/core` | The product tree, owned by root (HOST-05): `apps/core-server`, `apps/core-web`, `apps/transcriber`, `packages/shared`, `packages/capture-protocol`, with their npm dependencies (`npm ci --ignore-scripts`, lock file of the tree) | tracked files of the working tree, staged by `build-image.sh` |
| `/opt/dems/core/apps/capture-worker/build/` | `capture-worker`, `capture-relay`, `capture-guard`, built by the worker's own build file against the FFmpeg below (HOST-14, HOST-15) | `make -C apps/capture-worker` |
| `/opt/dems/ffmpeg-9.0.2` | FFmpeg 9.0.2 (libavformat 63.1.102), shared, ALSA input, no external codec library (HOST-12, HOST-13). Headers and pkg-config files removed | the stage copied **verbatim** from `scripts/host/container/Dockerfile.ubuntu-24.04` lines 30-107: archive SHA-256 `8c385028...e002e` and a valid signature of release key `FCF986EA...D67658D8` |
| `/opt/dems/node` | Node.js 26.8.2, the official Linux archive, SHA-256 pinned per processor (HOST-09) | nodejs.org |
| `/opt/dems/container/` | What this build recorded: `BUILD-INFO.txt` (base commit, uncommitted paths), `IMAGE-FACTS.txt`, `runtime-packages.txt`, and in `build-stage/`: FFmpeg's checksum and signature status lines, its configure log, the worker build logs and exit code, the build stage's packages | the build |
| `/usr/local/bin/dems-entrypoint` | Starts as root, makes the data directory the service account's, writes the database connection file from a mounted secret, then drops to `dems-core` or `dems-console` with no capability, an empty bounding set and no new privileges (HOST-38, HOST-39). Unsets `NODE_OPTIONS` (HOST-36) | `rootfs/opt/dems/docker/dems-entrypoint.sh` |

Accounts: `dems-core` (uid 10001, groups `dems-core` and `audio`, no shell) runs the Core and the tools; `dems-console` (uid 10002) runs the console server. Packages added at run time: `libasound2t64`, `alsa-utils` (`/usr/bin/arecord`, HOST-26), `iproute2`, `iputils-arping` (HOST-18), `iputils-ping` (profile 3.11), `procps` (HOST-17), `util-linux`.

## What is NOT in the image

- **No key, password, credential, signing key or operator account.** The image build checks that no `pg.env`, `pg.owner.env`, `pg.pwfile`, `*.p8`, `*.wrap`, keystore or helper file is in the image, and that the data directory is empty.
- **The address helper** (`scripts/host/netalias/`). It is a root service with a socket unit on the Linux HOST. It is never put in a container. It is optional, and all or none (host profile 3.8). It is NOT RELEASED for an installation before its host checks pass (README block "Task 4", decision C101). On a host that carries it, the Core container would need the socket's directory mounted, `DEMS_CAPTURE_ALIAS_SOCKET=/run/dems-core-netalias/socket`, and the helper's group. **None of that is built or tried here.**
- The test-fixture FFmpeg (GPL, x264 and x265) of the check container. So the **development sources** (generated test camera, README Known limit 13) **cannot run in this image**.
- The speech engine and its models (`<data-dir>/transcriber/host.json` names them; installer note 2.11).
- The mobile app, the mock Core, `apps/input-av`, `docs/`, `.data/`.
- A production build of the web console. A `vite build` of `apps/core-web` is Simulated-only by design (`apps/core-web/src/runtime/core-mode.ts`, rule 1). It never talks to a Core. See "The web console".

## Facts of the Core that shape this deployment (read from its code)

| Fact | Source | Consequence here |
|---|---|---|
| The Core listens on `127.0.0.1` only. A constant, not a setting | `apps/core-server/src/config.ts:47` | `network_mode: host`; nothing is published; open the console on the host itself or through `ssh -L 5173:127.0.0.1:5173 <host>` |
| The database host must be `127.0.0.1`, and port 5432 is refused | `config.ts:125-131`, `createConfig` | PostgreSQL shares the Core's loopback (host network, or `compose.isolated.yaml`), on port 4432 as in development |
| The database follows the listen port: 4420 is `dems_demo` | `config.ts:147` | The database commands take `--database dems_demo` |
| The data directory is fixed at `<tree>/.data` | `apps/core-server/src/plugins/config/load-config.ts`, `DEFAULT_DATA_DIR` | Volume `dems-data` at `/opt/dems/core/.data`. It holds `pg.env`, the media store, `credential-store` (session keys), `signer`, `handover`, `transcriber` |
| The error log is `apps/core-server/logs/errors.log` | `src/plugins/logger/error-log.ts` | Volume `dems-logs` |
| The Core serves no web console; only the Vite development server in Live mode talks to a Core, from origin `http://127.0.0.1:5173` | `config.ts:100-105`; `apps/core-web/vite.config.ts`; `core-mode.ts` | Service `console` runs that development server (`DEMS_CORE_PROXY_PORT=4420`) |

## Build

On a machine with Docker and git, from the repository root. The build needs `docker.io` (the pinned `ubuntu:24.04` and, for compose, `postgres:18.4`), the Ubuntu package archive, `ffmpeg.org` and `nodejs.org` for the pinned archives, and `registry.npmjs.org`.

```sh
deploy/docker/build-image.sh --platform linux/amd64 --save    # tag dems/core:task4-<commit>-unverified
deploy/docker/build-image.sh --platform linux/arm64 --save    # tag ...-unverified-arm64
```

The script refuses to build when the FFmpeg block of `Dockerfile` differs from its source lines. It stages only tracked files, plus this folder while it is uncommitted, into `.cache/docker-context/`. It never stages `.env` or `secrets/`. It builds under `.locks/heavy-host.lock`. With `--save` it writes `release/docker/<tag>.linux-<arch>.tar.gz` and its `.sha256` file. `--save-only` saves the image already tagged, without rebuilding, so the image that was smoke-tested is the one archived. It pushes nothing.

The classic builder (the only one without the buildx plugin) takes the local image of a multi-platform index for the machine's own platform. So the script builds from a staged copy of the Dockerfile that names the platform's own manifest of the pinned index, read at build time. The committed file is not changed. An amd64 build on an arm64 machine runs under qemu user emulation. qemu 7.0.0 (colima's default) crashed gcc while it compiled FFmpeg. qemu 10.2.3 (`tonistiigi/binfmt`) built the image, in about an hour.

**State at the build of 2026-10-14** (a date-stamped note, not a status display):

| | linux/amd64 | linux/arm64 |
|---|---|---|
| Tag | `dems/core:task4-6d6553e3-unverified` | `dems/core:task4-6d6553e3-unverified-arm64` |
| Image id | `sha256:fc27bc85...6b10` | `sha256:de41725f...a4b8` |
| Archive | `release/docker/dems_core_task4-6d6553e3-unverified.linux-amd64.tar.gz`, 297,920,351 bytes | `release/docker/dems_core_task4-6d6553e3-unverified-arm64.linux-arm64.tar.gz`, 293,751,887 bytes |
| Archive SHA-256 | `c8076c2b1cf7643b9657cf8946bc4b97f6b1d93dd3567f4049f13e81e02d26ab` | `3a65122bdc9befd5af5b189990b466cb79c7d85cf346fb3662e8a6a1e4bda25a` |
| `make -C apps/capture-worker` (all) | exit 2 at `relay-asan`: the AddressSanitizer runtime failed under qemu (`CHECK failed: sanitizer_allocator_primary32.h:292`). The fuzz run and the guard test were not reached. Everything before passed, and the required targets passed | exit 0 (all, including the sanitizer build, the fuzz run and the guard test's 83 checks) |
| Smoke test (SIMULATED) | PASS | PASS |

## Install on the Linux host

1. Copy the archive, its `.sha256` file and this folder (`compose.yaml`, `compose.isolated.yaml`, `postgres-init/`, `.env.example`, `README.md`) to the host. Then:

   ```sh
   sha256sum -c dems_core_task4-6d6553e3-unverified.linux-amd64.tar.gz.sha256
   gunzip -c dems_core_task4-6d6553e3-unverified.linux-amd64.tar.gz | docker load
   ```

2. **Secrets.** Run these in the folder that holds `compose.yaml`. The folder's mode protects the files on the host. The files themselves are readable inside the containers, because the PostgreSQL account (uid 999) and the entrypoint must read them through a bind mount.

   ```sh
   install -d -m 0700 secrets
   for n in dems_pg_superuser_password dems_pg_owner_password dems_pg_app_password; do
     (umask 077; openssl rand -hex 32 > "secrets/$n"); chmod 0444 "secrets/$n"
   done
   ```

   One line of 16 to 128 characters from `A-Z a-z 0-9 . _ ~ + / = -`. The entrypoint refuses anything else. No password is ever typed into a file of this folder by hand, printed or passed as an argument. `dems_pg_superuser_password` is used once, at the database's first initialisation (as `scripts/pg` uses `pg.pwfile`). After that nothing connects as `dems_admin`.

3. **Environment.** `cp .env.example .env` and set the values. The file holds placeholders only. Its keys are those of `apps/core-server/src/config.ts`.

## First start (SIMULATED operation)

This follows installer note section 4, steps 2 to 6.

```sh
docker compose up -d db                                          # first start initialises: roles dems_owner and dems_app, 127.0.0.1:4432, scram
docker compose run --rm tools db:create  --database dems_demo
docker compose run --rm tools db:migrate --database dems_demo
docker compose run --rm tools db:seed    --database dems_demo   # demo data set, demo operators WITH THE PUBLISHED DEMO PASSWORD
docker compose run --rm tools db:status  --database dems_demo
docker compose up -d core                                        # DEMS_CAPTURE_MODE=simulated
docker compose --profile console up -d console                   # http://127.0.0.1:5173 on the host
```

- `tools` runs one script of `apps/core-server/package.json` as `dems-core`: `db:create`, `db:migrate`, `db:seed`, `db:status`, `db:reset`, `operator:set-password`, `evidence:production-key`, `evidence:rotate-key`, `evidence:mark-compromised`, `evidence:verify-export`. For a `db:*` command it writes the owner file `pg.owner.env` into the data volume from the owner secret, and removes it when the command ends.
- **A seeded database is not a production database** (README Known limit 34, installer note step 4). Every operator has the published demo password until `operator:set-password` replaces it.
- The console is opened at `http://127.0.0.1:5173`, never `localhost`. Choose Live mode there. Through a tunnel use the same local port: `ssh -L 5173:127.0.0.1:5173 <host>`. The console server is Vite's **development server**, started with `--configLoader runner`: its default loader writes a temporary file next to `vite.config.ts`, which the root-owned tree refuses. It is not hardened for a network, and it is not exposed by anything here.
- Stop: `docker compose --profile console down` (the volumes stay). Never run `down --volumes` on an installation. `dems-pgdata` holds the audit chain, and `dems-data` holds the evidence and the session keys.

## First production boot: what the container can and cannot do

The installer's authority is `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md`. Its steps map to this deployment as follows. **None of them was run here.** Running the image in `REAL_PRODUCTION` was outside this row (decision C151 C-6).

| Installer note | Here |
|---|---|
| Step 1, the host profile (HOST-01 to HOST-49) | **Not satisfiable inside a container.** HOST-21 forbids a container runtime on the production host, because Docker turns on forwarding (HOST-20). The loopback rule, the service unit and the sleep, time and crash settings are facts of the host, not of a container |
| Steps 2 and 3, database | `db` service and the `tools` commands above. Open points HOST-50 to HOST-56 are answered here by one choice: the PostgreSQL project's image `postgres:18.4` (pinned by digest), port 4432, loopback only |
| Steps 5 and 6, the SIMULATED first boot and the unassigned-slot remedy | `core` and `console` in SIMULATED operation. Unassign the four slots in the console, and switch transcription off unless `.data/transcriber/host.json` is provided (installer note 2.11). Then stop: `docker compose stop core console` |
| Step 7, X-2 | `docker compose run --rm tools operator:set-password --database dems_demo --data-dir /opt/dems/core/.data --all-demo`. Each operator types their own password at the hidden prompt. Do the attended check of the prompt first (installer note 2.4). A `docker compose run` terminal is a pseudo-terminal of the Docker client: it is NOT "the keyboard of the host itself" unless the client runs on the host's own console (installer note 2.5) |
| Step 7, X-1 | `docker compose run --rm tools evidence:production-key --data-dir /opt/dems/core/.data`. Runs as `dems-core`, never root. The installation id typed here must equal `DEMS_INSTALLATION_DEVICE_ID` in `.env` (note 2.12). The directories above `/opt/dems/core/.data` in the image are root-owned and not writable by others (note 2.10) |
| Step 8, `DEMS_CAPTURE_MODE=real` | What the Core's boot would say, **read from the code, not run**: checks 4, 4b, 4b-2 (installation binding: refused `CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH` unless the certificate names `DEMS_INSTALLATION_DEVICE_ID`), 4b-3 and 4c judge the key and the operators exactly as on a host. **4d, the host profile**, is asked because the container's platform is `linux`. Its first Linux question is `/usr/bin/systemctl is-active dems-loopback-rule.service`, and the image has no service manager. So a start is expected to be refused with `CAPTURE_HOST_LOOPBACK_RULE_MISSING` (`apps/core-server/src/capture/boot/host-checks.ts`, the question list), and forwarding (`CAPTURE_HOST_FORWARDING_ON`) would follow on a Docker host. **4e, the programs**: the relay and guard paths of `.env.example` lie in the root-owned tree, and the relay states the pinned libavformat. The helper is absent, which is allowed and stated as `CAPTURE_HOST_ALIAS_HELPER_ABSENT`. The entrypoint prints a note when production capture is requested |
| Steps 9 to 12, helper, cameras, microphones, sessions | Not available in a container: no camera network, no ALSA card is passed in, no helper. Out of scope |

**Backups** (installer note 2.8). Do not copy `dems-data/_data/signer/` into any backup or image. A volume backup of `dems-data` must exclude `signer/` before the first key is made. The certificate in `signer/` and `handover/` is public.

## The smoke test that was run

`deploy/docker/smoke-test.sh [<tag>]`. SIMULATED operation, three random throw-away passwords, `compose.isolated.yaml` (one private network namespace, nothing published), its own compose project under `.cache/docker-smoke/`. It brings up `db`, runs `db:create`/`db:migrate`/`db:seed`/`db:status`, brings up `core` and asks `GET /api/v1/health`, brings up `console` and asks `/` and `/api/v1/health` through its proxy. At the end, also after a failure, it runs `docker compose down --volumes` and removes its folder. Its result lines are in the task record named at the top.

## Files

| File | What |
|---|---|
| `Dockerfile` | Stage 0: the verbatim FFmpeg stage, then the worker build. Stage `nodedeps`: Node.js and `npm ci`. The last stage is the runtime image |
| `build-image.sh` | Stages the context, checks the verbatim block, picks the base manifest for the platform, builds, saves |
| `compose.yaml` | `db`, `core`, `console` (profile), `tools` (profile). Host network. Secrets from `./secrets`, environment from `./.env` |
| `compose.isolated.yaml` | Override: one private network namespace instead of the host's |
| `.env.example` | The Core's environment keys, placeholders only |
| `postgres-init/10-dems-roles.sh` | First initialisation of the database: roles, `postgresql.conf` block, `pg_hba.conf` |
| `rootfs/opt/dems/docker/dems-entrypoint.sh` | The entrypoint |
| `smoke-test.sh` | The throw-away SIMULATED smoke test |
| `secrets/` | The operator's three password files. Git ignores everything in it but its `.gitignore` |
