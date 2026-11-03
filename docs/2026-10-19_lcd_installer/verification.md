# Verification — Linux Docker installer including LCD

Completed 2026-10-19 on branch `task4/input-av-core-port`, base commit e05a1567, with the authorized uncommitted LCD integration included. Self-review only; no independent reviewer. No commit or push.

## Deliverables

| Architecture | Archive in release/installers | Bytes | SHA-256 |
|---|---|---:|---|
| linux/amd64 | DEMS-Linux-Docker-LCD-20261019-amd64-unverified.tar.gz | 472834541 | 88f0909d1c8b2d3e016c47fefc5ebb3a16ef1948fa5529093ba064189411b855 |
| linux/arm64 | DEMS-Linux-Docker-LCD-20261019-arm64-unverified.tar.gz | 466954506 | d83982ff74c6503898883b02a818d751a6f51635c7cee8498a4ade3005d9925b |

Each archive includes `install.sh`, Indonesian instructions, Compose, configuration template, PostgreSQL first-init script, the two offline images in `images.tar.gz`, build/source records, passing smoke excerpt, license notices and SHA256SUMS. No deployment `.env`, secrets, `.installed` marker or AppleDouble files are included. The installer in each final archive is byte-equal to the tested source script.

Core+LCD images:
- amd64 `dems/core:task4-e05a1567-lcd-20261019-amd64-unverified`: sha256:905efaf2fe27b6bceb2c58d86674db59aaaa85fba3cd820379ea223d52446de3
- arm64 `dems/core:task4-e05a1567-lcd-20261019-arm64-unverified`: sha256:e822f1b5507363f9514f0589721dd176bbda9caf99d6b95d250bc16bb0a09b85

PostgreSQL 18.4 uses the existing pinned registry index sha256:a02db8cac496f15b094798a38254f14d6e00741f709360e5e00bb6668ea31636, exported for each target platform and tagged dems/postgres:18.4-lcd-<arch>. The amd64 child read by Docker is sha256:4cc13dede823cab4e05290c7fb3350fb4e599ecabd9b07e6706b5d5e8f5bc929. Docker export preserves the official image's untagged provenance/attestation metadata (unknown/unknown config); every tagged runnable config was checked to be linux plus the requested architecture.

## Implemented behavior

- Full Core Dockerfile adds Python and Ubuntu python3-serial (runtime import asserts serial 3.5). Authorized new product files are staged alongside tracked files, including Core's LCD unit and the backend. Source SHA inventory records the exact staged snapshot rather than pretending the working tree is a clean commit.
- `lcd` service uses that same Core image, UID/GID 10001, discovered serial-device supplementary GID, no capabilities, read-only root and media, loopback 8090. Core receives the LCD URL; no separate pip/npm/LCD installation is needed.
- Installer verifies shipped checksums and target CPU, imports the images offline, refuses existing config or DEMS data/containers, checks missing serial device before creating config and requires explicit `--without-lcd` when no panel is connected. Initial install alone creates random database passwords, migrates/seeds a NEW demo database and writes `.installed` only after healthy startup.
- start refuses incomplete installation; stop only stops containers and never removes volumes. Existing configuration/passwords remain unchanged. The installer does not offer automatic upgrades over an existing DEMS deployment.
- Export helper requires the passing LCD smoke log for the exact image tag. Package hash/provenance and smoke evidence are self-contained.

## PASS

| Check | Result |
|---|---|
| amd64 complete image build | exit 0; Python/serial and new Core LCD source present |
| arm64 complete image build | exit 0; Python/serial and new Core LCD source present |
| Installer unit/integration tests with Docker stubs | 9 tests PASS: integrity, CPU mismatch, missing panel, existing config/data, offline init, positive USB configuration, preservation on start/stop, refusal of partial start |
| Shell syntax (4 installer/build/smoke scripts) | PASS |
| amd64 isolated Docker smoke, QEMU 10.2.3, all services target amd64 | PASS: create/migrate/seed/status, ready Core, console and proxied health HTTP 200, LCD backend healthy and four channels synchronized by Core |
| arm64 isolated Docker smoke, native services | PASS: same checks |
| LCD truth in both Docker smokes | PASS: all four channels receive heartbeat, nrec=0, last_req_ms=0; no recording or USB communication fabricated |
| Temporary smoke projects | all own containers and volumes removed; existing SMARTWMS containers untouched |
| Inner SHA256SUMS after extracting | PASS on both architectures, including SMOKE-TEST.txt |
| Runnable configs inside actual Docker export | PASS: exactly Core and PostgreSQL tagged for requested Linux architecture |
| docker image load of both actual exports | Loaded both expected Core/PostgreSQL tags on each architecture; no network needed |
| Final outer archives | byte sizes and SHA-256 verified; installer matches tested script; no deployment secrets or generated config included |
| git diff --check | PASS |

Previous LCD software checks remain in ../2026-10-19_lcd_integration/verification.md: 7-workspace typecheck, web build, 396 Core/static tests, 24 web tests, 63 contract/OpenAPI tests and 4 Python tests. Runtime source was unchanged while packaging; these suites were not repeated unnecessarily.

## Bounded recovery

1. Docker CLI registry-index verification failed before the first build. Reused the immutable per-platform Ubuntu child digests recorded and built in task4 DK; verified local architecture. No insecure registry bypass or new base version.
2. The initial amd64 smoke failed in esbuild's Go runtime under the Colima default QEMU 7.0.0. Reproduced the transform failure. Re-registered the already pinned tonistiigi/binfmt image inside the temporary VM, verified QEMU 10.2.3, then the target-amd64 smoke passed. No product workaround or model/config change.
3. One early arm64 run was invalidated by editing the executing smoke script. Final runs used a stable script snapshot; shell syntax and the full final native smoke passed. These invalid/failed runs were not counted as passes.
4. No ambiguous deployment mutation retried: all smoke resources had unique throw-away project names, and teardown was observed before subsequent attempts.

Logs: .cache/lcd-installer-build-{amd64,arm64}.log; .cache/lcd-installer-smoke-amd64-qemu10.log (also copied to -amd64-final.log); .cache/lcd-installer-smoke-arm64-final.log; .cache/lcd-installer-package-{amd64,arm64}.log; .cache/lcd-installer-load-{amd64,arm64}.log. Image-internal worker/FFmpeg build records are retained.

## NOT RUN / limitations

- No ESP32/USB hardware or physical display rendering test. Firmware is not present in the supplied source ZIP and is not included.
- Installer was not deployed against a real target Linux host. Installer state transitions use Docker stubs; actual included images were independently tested together inside isolated Docker namespaces and imported from the archives.
- Whole task4 regression, real production capture, cameras/microphones, host hardening, physical serial permissions and Linux installation acceptance remain unverified. Packages deliberately retain the `unverified` label and default SIMULATED capture.
- Existing Docker production-host restrictions remain; this is a demo/bench installer. Docker Engine/Compose, bash, openssl and ordinary Linux utilities are prerequisites on the target. The runtime/application/database/LCD images themselves are bundled for offline use.
- No user database, production source, host firewall, signing key, credential, emulator, provider/model or unrelated repository file was altered. ffprobe-export.txt remains untouched.

Build environment: Colima was initially stopped. It was started using its existing profile (4 CPU/8 GiB), automatically restarting its existing SMARTWMS containers. Those containers were not deleted or reconfigured. After packaging/testing, Colima is stopped again to restore its initial state. Docker context remains colima. The temporary VM binfmt registration disappears on stop; no persistent model/provider or Colima profile settings were changed.
