# Row DK - Docker image of the DEMS Core for Linux (docker-specialist)

Status: complete (UNVERIFIED image, as ordered). Base: task4/input-av-core-port at 6d6553e3, plus the uncommitted C156 fix in apps/core-server/src/capture-composition.ts. Nothing committed, nothing pushed.
Record: implementation/dk_docker_image.md (Tier 3: commands, attempts, sizes, hashes, smoke lines).

Built: linux/amd64 (target) and linux/arm64.
- amd64: tag dems/core:task4-6d6553e3-unverified, id fc27bc85...6b10; archive release/docker/dems_core_task4-6d6553e3-unverified.linux-amd64.tar.gz, 297,920,351 bytes, SHA-256 c8076c2b1cf7643b9657cf8946bc4b97f6b1d93dd3567f4049f13e81e02d26ab.
- arm64: tag dems/core:task4-6d6553e3-unverified-arm64, id de41725f...a4b8; archive release/docker/dems_core_task4-6d6553e3-unverified-arm64.linux-arm64.tar.gz, 293,751,887 bytes, SHA-256 3a65122bdc9befd5af5b189990b466cb79c7d85cf346fb3662e8a6a1e4bda25a.
Smoke test (SIMULATED, throw-away volumes, isolated namespace): PASS on both. db:create/migrate (34 migrations, schema 15)/seed/status exit 0; Core /api/v1/health 200 (uid 10001, CapBnd 0, NoNewPrivs 1); console / 200 and /api/v1/health 200 through its proxy; teardown left 0 containers and 0 volumes.
Worker `make` (all): amd64 exit 2 at relay-asan (AddressSanitizer CHECK failure under qemu; required targets exit 0); arm64 exit 0.

Files created: deploy/docker/{README.md, Dockerfile, build-image.sh, smoke-test.sh, compose.yaml, compose.isolated.yaml, .env.example, postgres-init/10-dems-roles.sh, rootfs/opt/dems/docker/dems-entrypoint.sh, secrets/.gitignore}; this file; implementation/dk_docker_image.md. Tracked files changed: 0. Shared files (02_plan.md, status_tasks.md, decisions.md): not written - for the controller.

Findings for the controller (decisions the user may want):
1. The Core does not serve the web console. A production `vite build` is Simulated-only. The image's console is the Vite DEVELOPMENT server (Live mode), started with `--configLoader runner` because the tree is root-owned.
2. Every listener is 127.0.0.1 by code. compose.yaml uses network_mode: host (Linux only; not run in that mode here). Remote use is through an SSH tunnel.
3. REAL_PRODUCTION in a container is expected to be refused at check 4d (`CAPTURE_HOST_LOOPBACK_RULE_MISSING`). This is read from the code, not run. HOST-21 forbids a container runtime on the production host. The image is a SIMULATED/bench package. The production host stays native per the host profile.
4. Development sources cannot run in the image (no libx264; Known limit 13).

Environment: colima started (was stopped) and stopped again. colima.yaml rosetta flag restored (hash equal to before). Docker context back to default. qemu 10.2.3 registered in the VM for amd64 (gone at VM stop). ONE UNASKED SIDE EFFECT: `docker image prune -f` removed all dangling images in the colima VM, not only this row's; tagged images intact. Images left in the VM: the two dems/core tags, postgres:18.4, tonistiigi/binfmt.
Network used: docker.io, archive/security.ubuntu.com, ports.ubuntu.com, ffmpeg.org, nodejs.org, registry.npmjs.org. Devices opened: none. .data/ and apps/input-av/: not read.
