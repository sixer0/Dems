# DK - DEMS Core Docker image for Linux (UNVERIFIED)

Tier 3 record. Row DK, task 4, 2026-10-14, on the user's word of decision C156 ("package deployment ke linux", form: Docker image). Tree: branch `task4/input-av-core-port`, HEAD `6d6553e33a4b79ac6b2caf15160fab1a4f655725` plus the uncommitted Core typecheck fix in `apps/core-server/src/capture-composition.ts` (C156). Evidence basis: `tsc` 0 in every workspace (C156). **No test suite was run on the tree.** The images are labelled UNVERIFIED (`LABEL dems.verification=UNVERIFIED`, tag suffix `-unverified`). Nothing was committed and nothing was pushed.

## Result

| | linux/amd64 (the target) | linux/arm64 (also built: native here, so cheap) |
|---|---|---|
| Tag | `dems/core:task4-6d6553e3-unverified` | `dems/core:task4-6d6553e3-unverified-arm64` |
| Image id | `sha256:fc27bc851110ef5a6ea65e98e8e446c8711c2f524af24eb972cf5ac7c1cc6b10` | `sha256:de41725f011183e4e1b24e9fc91ed6346f5cf900b3e9870defd5b16fbe55a4b8` |
| Size (unpacked, `docker image ls`) | 1.65 GB | not read |
| Archive (`docker save \| gzip -n -6`; git-ignored by `/release/`) | `release/docker/dems_core_task4-6d6553e3-unverified.linux-amd64.tar.gz` | `release/docker/dems_core_task4-6d6553e3-unverified-arm64.linux-arm64.tar.gz` |
| Archive size | 297,920,351 bytes | 293,751,887 bytes |
| Archive SHA-256 (also in `<archive>.sha256`) | `c8076c2b1cf7643b9657cf8946bc4b97f6b1d93dd3567f4049f13e81e02d26ab` | `3a65122bdc9befd5af5b189990b466cb79c7d85cf346fb3662e8a6a1e4bda25a` |
| Base | `ubuntu@sha256:f610ab94648195aa356059f5b41d6085c9d4d903c072430cdd1af7bdb646106b` | `ubuntu@sha256:08571ca13e00ca07a2a84eab83a959b4242e22cceb16486a11bef1428c9e93a7` |
| Base pin | both are the platform manifests of the pinned index `ubuntu:24.04@sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55` (read by `docker manifest inspect` at build) | |
| capture-worker | 347,072 bytes, sha256 `2db4d964919ef253c695a0be1c5daeb92abcbebc525c02373752b73bdb0a15d3` | 396,744 bytes, sha256 `8616592fff60847be24ba9283e8b71c90739950ef5812c0e79ddd8f45a6c133e` |
| capture-relay | 240,688 bytes, sha256 `22ba42a73ad059d9872368562d39a6fadc8c1a49ce6c70e58e8022fe37ce110e` | 244,312 bytes, sha256 `335c0217728f77af53972232b85df263713be453a41bf577a4079f28fbfb2047` |
| capture-guard | 25,880 bytes, sha256 `1c93f07ef666d1007d52462002fac4380c61edfb9856c0508a5db0fd481d4fc5` | 80,976 bytes, sha256 `2eba60d1df6cddef42c21c334b84e8cd96da78bf5fd8ddc08167b9ed30bb26ca` |
| `make -C apps/capture-worker` (all, HOST-14 verdict, recorded) | **exit 2** at `relay-asan`: `AddressSanitizer: CHECK failed: sanitizer_allocator_primary32.h:292 "((res)) < ((kNumPossibleRegions))"`, under qemu-user. Passed before it: check, selftest, unit, the worker binary with its import net, relay-check with its self-test, `relay_unit_test: 989 checks passed; ... 34 of 34`. Not reached: relay-fuzz, the relay binary inside `all`, the guard test | **exit 0**: everything, including `guard_test: all 83 checks hold` |
| Required targets (`check selftest unit relay-check relay-unit` and the three binaries) | exit 0 | exit 0 |
| Smoke test (SIMULATED) | PASS | PASS |

The amd64 sanitizer failure is read as an emulator effect, not a finding about the code, because the same tree passes all of `make` natively on arm64. That reading is an inference: no amd64 machine was available to run `relay-asan` natively.

## What is inside (both images)

- `/opt/dems/core` (root:root, mode 755, `chmod -R go-w`): the tracked files of `apps/core-server`, `apps/core-web`, `apps/transcriber`, `apps/capture-worker`, `packages/shared`, `packages/capture-protocol`, the root manifests and `THIRD_PARTY_NOTICES.md`, `deploy/docker`. `node_modules` comes from `npm ci --ignore-scripts -w @dems/shared -w @dems/capture-protocol -w @dems/transcriber -w @dems/core-server -w @dems/core-web` (676 packages; `tsx v4.23.15`, `vite 8.3.1`). Unpacked sizes: tree 922 MB, Node 230 MB, FFmpeg 30 MB.
- `/opt/dems/core/apps/capture-worker/build/{capture-worker,capture-relay,capture-guard}` (root, 755).
- `/opt/dems/ffmpeg-9.0.2`: FFmpeg 9.0.2, `ffmpeg -version` first line `ffmpeg version 9.0.2`, libavformat 63.1.102, ` DE alsa`. Built by lines 30-107 of `scripts/host/container/Dockerfile.ubuntu-24.04`, copied verbatim (`cmp` identical; source file sha256 `3ef2a7317c171e810d1263dc86ab1a8ec90852caf23d3d5431fea9264bc18a34`). The archive's recorded checks: `8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e  ffmpeg-9.0.2.tar.xz`, `[GNUPG:] GOODSIG B4322F04D67658D8 FFmpeg release signing key`, `[GNUPG:] VALIDSIG FCF986EA15E6E293A5644F10B4322F04D67658D8`. Headers and pkg-config removed in the runtime.
- `/opt/dems/node`: Node.js v26.8.2. Archive SHA-256 pinned: x64 `40e1d3225c1c9ae9a2671c98ecb9857e4d5555026394f348645676798840d5c5`, arm64 `81d8f0fdea9dcd3bfdcfeafc5f8359c151f097e9880b0007c0645ca670d07971`, read from `https://nodejs.org/dist/v26.8.2/SHASUMS256.txt`. That file's sha256 `c31cbd53...7dad3` equals the copy in `.cache/release/node-v26.8.2/`. Its signature was not checked.
- Accounts: `uid=10001(dems-core) groups=10001(dems-core),29(audio)` and `uid=10002(dems-console)`. `.data` and `.data/media/sessions` are owned by `dems-core`, mode 700, and empty of files. `apps/core-server/logs` is owned by `dems-core`. `apps/core-web/node_modules/.vite` is owned by `dems-console`.
- Runtime packages: `ca-certificates libatomic1 libasound2t64 alsa-utils iproute2 iputils-arping iputils-ping procps util-linux`. Build checks: `dpkg -S /usr/bin/arping` gives `iputils-arping`; no `ffmpeg`, `libavformat-dev` or `arping` package is installed.
- Build-time absence checks (`find / -xdev`): no `dems-core-netalias*`, `pg.env`, `pg.owner.env`, `pg.pwfile`, `*.p8`, `*.wrap`, `*.keystore` or `*.jks`.
- `/opt/dems/container/`: `BUILD-INFO.txt` (base commit; `M apps/core-server/src/capture-composition.ts`; `?? deploy/docker/`), `IMAGE-FACTS.txt`, `runtime-packages.txt`, and `build-stage/` (apt candidates, FFmpeg source checksums, configure log, `worker-make-all.log`/`.rc`, `worker-make-required.log`, `worker-programs.txt`, builder `packages.txt`).

## Files made (new folder `deploy/docker/`, untracked, not committed)

`README.md`, `Dockerfile`, `build-image.sh`, `smoke-test.sh`, `compose.yaml`, `compose.isolated.yaml`, `.env.example` (placeholders only), `postgres-init/10-dems-roles.sh`, `rootfs/opt/dems/docker/dems-entrypoint.sh`, `secrets/.gitignore`. No tracked file was changed by this row. The repository's `/.dockerignore` (row 78's) was not touched: the context is staged in `.cache/docker-context/`.

## Commands (all from the repository root; docker commands ran outside the command sandbox, because the docker socket is under `~/.colima`)

```
colima start --cpu 4 --memory 8 --vz-rosetta          # colima was stopped before this row
  # Rosetta is NOT installed on this Mac (`arch -x86_64 /usr/bin/true`: Bad CPU type), so --vz-rosetta took no
  # effect; it did change ~/.colima/default/colima.yaml `rosetta: false -> true` (backed up first; restored at the end).
docker pull postgres:18.4                              # -> postgres@sha256:a02db8cac496f15b094798a38254f14d6e00741f709360e5e00bb6668ea31636 (PGDATA /var/lib/postgresql/18/docker)
deploy/docker/build-image.sh --platform linux/amd64    # (attempts below)
docker run --rm --privileged tonistiigi/binfmt@sha256:400a4873b838d1b89194d982c45e5fb3cda4593fbfd7e08a02e76b03b21166f0 --uninstall qemu-x86_64
docker run --rm --privileged tonistiigi/binfmt@sha256:400a4873...66f0 --install amd64
docker run --rm -e QEMU_VERSION=1 --platform linux/amd64 ubuntu@sha256:f610ab94... /bin/true   # -> qemu-x86_64 version 10.2.3
/usr/bin/lockf -k -t 3600 .locks/heavy-host.lock deploy/docker/smoke-test.sh dems/core:task4-6d6553e3-unverified
deploy/docker/build-image.sh --platform linux/amd64 --save-only
gunzip -c release/docker/dems_core_task4-6d6553e3-unverified.linux-amd64.tar.gz | docker load    # -> Loaded image ...; id fc27bc85... amd64
deploy/docker/build-image.sh --platform linux/arm64                  # 912 s, exit 0
/usr/bin/lockf -k -t 3600 .locks/heavy-host.lock deploy/docker/smoke-test.sh dems/core:task4-6d6553e3-unverified-arm64
deploy/docker/build-image.sh --platform linux/arm64 --save-only
(cd release/docker && shasum -a 256 -c *.sha256 && gzip -t ...)       # both OK
```

### amd64 attempts, in order

| # | What happened | Change |
|---|---|---|
| 1 | The classic builder took the cached **arm64** image of the multi-platform base index despite `--platform linux/amd64` (apt fetched from `ports.ubuntu.com`). Also `deploy/docker/` is untracked, so `git ls-files` did not stage it. Stopped by hand | `build-image.sh` stages the untracked, not-ignored files of `deploy/docker`. The staged copy of the Dockerfile names the platform's own manifest of the pinned index. Probe: an amd64 child digest gives `x86_64`/`amd64` |
| 2 | `REFUSED: deploy/docker/secrets/.gitignore would be staged`: the script's own guard | Guard lets `secrets/.gitignore` pass and keeps refusing any other file in `secrets/` |
| 3 | FFmpeg compile: `gcc: internal compiler error: Segmentation fault signal terminated program cc1` (`libavfilter/af_acrossover.o`) after 1260 s, under colima's `qemu-x86_64 version 7.0.0`. No OOM in `dmesg`; free memory 6.4 GB | qemu 10.2.3 registered in the VM (kernel binfmt state, gone when the VM stops) |
| 4 | Node stage: `node: error while loading shared libraries: libatomic.so.1` after 3485 s (FFmpeg and worker layers done and cached) | `libatomic1` added to the node stage and the runtime |
| 5 | Runtime check failed: my test `ls -A .data` was empty-or-fail, but the image makes `.data/media/sessions` on purpose | The check became "no non-directory in `.data`" |
| 6 | Built, 117 s (cached layers); image `98e19260...`. Smoke test 1: **FAIL** at the console. `EACCES: permission denied, open '/opt/dems/core/apps/core-web/vite.config.ts.timestamp-...mjs'`: Vite's default config loader writes next to the config, and the tree is root-owned. Teardown clean | Entrypoint starts Vite with `--configLoader runner` (checked first in a throw-away `--network none` container: `VITE v8.3.1 ready`, `/` 200, `/src/main.tsx` 200) |
| 7 | Built, 119 s; image `fc27bc85...`. Smoke test 2: **PASS**. This image was saved | - |

## Smoke test lines (amd64, image fc27bc85; log `.cache/docker-smoke/dems-smoke-20261014t085925z.log`)

```
[smoke 08:59:25] image dems/core:task4-6d6553e3-unverified (linux/amd64 sha256:fc27bc85...6b10)
[smoke 08:59:31] db healthy after 5s
  10-dems-roles: roles dems_owner and dems_app created (passwords given as SCRAM-SHA-256, not printed)
  LOG:  listening on IPv4 address "127.0.0.1", port 4432
[smoke 08:59:36] db:create exit 0     (created dems_demo (owner dems_owner, encoding UTF8, locale C) on PostgreSQL 18.4)
[smoke 08:59:45] db:migrate exit 0    (applied 34 migration(s) ... schema version after: 15 (dbc-16))
[smoke 09:00:02] db:seed exit 0       (v2 demo packages: NOT generated (NOT_A_DEVELOPMENT_CAPTURE_CORE) - SIMULATED)
[smoke 09:00:11] db:status exit 0     (OK: dems_demo is at the schema version this code expects and the ledger matches the files)
[smoke 09:00:37] core healthy after 25s   (boot steps B-1..B-9, engine.rehydrate, rbac.matrix passed)
HTTP 200 http://127.0.0.1:4420/api/v1/health {"status":"ok","service":"dems-core-server","version":"0.2.0","apiVersion":"v1",...,"ready":{"database":true,"engine":true}}
  Uid: 10001 10001 10001 10001 | CapEff: 0000000000000000 | CapBnd: 0000000000000000 | NoNewPrivs: 1
HTTP 200 http://127.0.0.1:5173/ <!doctype html> <html lang="en" class="dark" data-theme="dark"> ...
HTTP 200 http://127.0.0.1:5173/api/v1/health {"status":"ok","service":"dems-core-server",...}   (through the console's proxy)
  VITE v8.3.1  ready in 6276 ms
[smoke 09:00:58] teardown done; project folder removed; RESULT PASS
```

arm64 (image de41725f; log `.cache/docker-smoke/dems-smoke-20261014t091808z.log`): the same steps all exit 0. Core healthy after 10 s, the same three `HTTP 200` lines, `CapBnd 0`, `NoNewPrivs 1`, RESULT PASS. After each run: `docker ps -a | grep -c smoke` = 0 and `docker volume ls | grep -c smoke` = 0. The first, failed amd64 run (`.cache/docker-smoke/dems-smoke-20261014t084424z.log`) also tore down completely.

The smoke test ran SIMULATED operation only. It used three random throw-away passwords (`openssl rand -hex 32`), `compose.isolated.yaml` (one private network namespace, nothing published) and its own compose project. No camera, microphone, host network or `REAL_PRODUCTION` was used (C151 C-6).

## What the operator must still provide (README, "Install", "First start", "First production boot")

The three password files in `deploy/docker/secrets/` and `.env` from `.env.example`. Then `db:create`/`db:migrate`/`db:seed`. For a production boot: X-2 `operator:set-password`, X-1 `evidence:production-key` (installation id equal to `DEMS_INSTALLATION_DEVICE_ID`, never a reserved id), the transcriber host file or STT off. The address helper on the HOST if wanted (not released). A way to reach `127.0.0.1:5173` on the host (local browser or `ssh -L`).

## Stated limits

- **REAL_PRODUCTION inside a container is expected to be refused.** This is read from the code and was not run: host check 4d asks `/usr/bin/systemctl is-active dems-loopback-rule.service` first on Linux, the image has no service manager, so the expected code is `CAPTURE_HOST_LOOPBACK_RULE_MISSING` (`apps/core-server/src/capture/boot/host-checks.ts`). HOST-21 forbids a container runtime on the production host. The image is fit for SIMULATED or bench use. A production installation follows the host profile natively.
- The Core does not serve the web console. A production `vite build` is Simulated-only (`apps/core-web/src/runtime/core-mode.ts` rule 1). The only console that talks to a Core is the Vite development server (service `console`).
- All listeners bind `127.0.0.1` (code constant). `compose.yaml` uses `network_mode: host` (Linux only). It was not run in host mode here. Only `compose.isolated.yaml` was run.
- Development sources cannot run in the image (no libx264 in the pinned FFmpeg; Known limit 13).
- `npm ci --ignore-scripts`: no install script ran (esbuild's verification script and vue-demi's postinstall included). `tsx` and the Vite server ran in the smoke test.
- The Node SHASUMS signature and the Ubuntu package versions are not pinned or checked. What was installed is listed in the image.
- The compose secrets are files of mode 0444 inside a 0700 folder: readable by every process inside the containers that mount them.

## Environment changes made and reverted (or not)

- colima was started by this row (it was stopped) and stopped at the end. Starting it also started the user's other containers with restart policies (`smartwms/suara`, `pgvector/pgvector:pg17`). They were not touched, and they stopped with the VM.
- `~/.colima/default/colima.yaml`: `rosetta: true` was written by `colima start --vz-rosetta` and restored from the backup (sha256 `0bd93933...ec71a` before and after; see row_dk.md).
- Docker CLI context: colima created the `colima` context and made it current. It was switched back to `default` at the end.
- VM binfmt: qemu 10.2.3 registered for x86_64. Gone when the VM stopped.
- **Not reverted:** `docker image prune -f` was run once, after the platform probe (about 14:13 WIB). It removed every dangling (untagged, unreferenced) image in the colima VM, not only this row's. Tagged images were not affected (listing taken right after it). What it removed was not listed.
- Left in the colima VM: the two `dems/core` images, `postgres:18.4`, `tonistiigi/binfmt`, the amd64 `ubuntu` manifest, and the classic builder's intermediate layers. Left in `.cache/` (git-ignored): `docker-context/build-{amd64,arm64}.log` and the smoke logs. The staged context trees were removed.
