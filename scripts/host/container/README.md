# The Ubuntu 24.04 container of the capture programs

A development check, not a product part. It builds the capture worker, the camera relay and the capture guard on Ubuntu 24.04 against FFmpeg 9.0.2 (libavformat 63.1.102), as items `HOST-10` to `HOST-15` of `../HOST-PROFILE-UBUNTU-24.04.md` state it, so that what differs from the development Mac is seen before the real host is.

**A container result is a container result.** It settles nothing for the production host (host profile, section 5): the kernel is the virtual machine's, the processor architecture is the Mac's (arm64), there is no service manager, no sound card and no camera. The image is never installed, shipped or pushed.

## Files

| File | What it is |
|---|---|
| `Dockerfile.ubuntu-24.04` | The definition: base image pinned by digest, the profile's package list, FFmpeg built from the official archive (SHA-256 and release-key signature both checked), the tools of the later container checks, the product tree, then the build of the three programs with its log kept in the image |
| `build-in-container.sh` | Runs inside the container only (it refuses elsewhere). `make versions`, the verdict `make -C apps/capture-worker`, every step of that build by itself with its exit code, the three binaries |
| `/.dockerignore` (repository root) | What is sent as build context. An allow list: `apps/capture-worker` without its `build/`, `scripts/host`, `scripts/hardware-acceptance`. It lies at the root because the classic builder reads no ignore file anywhere else |

## Use

From the repository root, on the development Mac, with a running container runtime. Take the heavy-host lock for every build and every run.

```sh
# build (about 7 minutes the first time on 4 virtual processors, of which FFmpeg about 4; needs the network, see below)
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
  docker build -f scripts/host/container/Dockerfile.ubuntu-24.04 \
               -t dems/capture-linux-check:ubuntu-24.04-ffmpeg-9.0.2 .

# the result that was recorded while the image was built (no network needed)
docker run --rm --network none dems/capture-linux-check:ubuntu-24.04-ffmpeg-9.0.2

# the build again, live, in a fresh container
docker run --rm --network none dems/capture-linux-check:ubuntu-24.04-ffmpeg-9.0.2 \
  bash scripts/host/container/build-in-container.sh

# a shell for the later container checks; `dems-check` is an account without rights
docker run --rm -it --network none dems/capture-linux-check:ubuntu-24.04-ffmpeg-9.0.2 bash
```

After a change of the worker's sources, build the image again: the layers up to FFmpeg come from the cache, the tree is copied anew and the three programs are rebuilt (about one minute).

Inside the image:

| Path | Content |
|---|---|
| `/opt/dems/core` | The product tree as sent (the profile's proposed `<install-dir>`), owned by root |
| `/opt/dems/ffmpeg-9.0.2` | The pinned FFmpeg (the profile's proposed `<ffmpeg-prefix>`); the loader finds it (`HOST-13`) |
| `/opt/dems/core/apps/capture-worker/build` | What the build produced |
| `/opt/dems/container/build.log`, `build.rc` | Output and exit code of `build-in-container.sh` at image build |
| `/opt/dems/container/context-manifest.txt` | Every file that arrived as build context |
| `/opt/dems/container/packages.txt`, `apt-candidates.txt` | Installed package versions; what the distribution offers for FFmpeg and for the two packages named `arping` |
| `/opt/dems/container/ffmpeg-source.sha256`, `ffmpeg-config.log` | The archive's checksum, the signature status lines, the configure log |

## What the build fetches, and what is pinned

| From | What | Pinned by |
|---|---|---|
| `docker.io` | `ubuntu:24.04` | digest `sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55` |
| `http://ports.ubuntu.com/ubuntu-ports/` (arm64; the Ubuntu archive on amd64) | packages | not pinned; the installed versions are listed in the image |
| `https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz` | the release source, 12,040,788 bytes | SHA-256 `8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e` |
| `https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz.asc` | its detached signature | must be a valid signature of the key below |
| `https://ffmpeg.org/ffmpeg-devel.asc` | the FFmpeg release signing key | fingerprint `FCF986EA15E6E293A5644F10B4322F04D67658D8` |

Nothing of the repository is uploaded: the context goes to the local docker daemon only. Containers are run with `--network none`.

## Tools for the later container checks

`procps`, `psmisc` (the process table: short names, full paths, survivors after a killed parent), `util-linux` (`prlimit`, `setpriv`), `iputils-arping` and `iproute2`, `alsa-utils` (the `null` and `file` devices for the microphone helper's argument list; the pinned `ffmpeg` has the ALSA input), `strace`, `file`, `binutils`, `python3`. The test fixtures of the worker and `scripts/hardware-acceptance/` are in the tree.

## State at the first build (2026-10-13)

`make -C apps/capture-worker` does **not** end 0 in the container. The relay and the guard build and are hardened; the worker does not compile. The findings and their owners are in `docs/2026-10-12_input_av_core_adapter_plan/implementation/078_linux_container_build.md`. This paragraph is a date-stamped note, not a status display: read the image's own `build.log` for the tree you built.

## State after task 4 row 193 (2026-10-13, later the same day)

`make -C apps/capture-worker` ends **0** in the container: the worker, the relay and the guard build, and the worker's static rules with their self-test, the unit checks, the relay's unit checks plain and under the sanitizers, the fuzz run and the guard test pass (record, with the image's identifier: `docs/2026-10-12_input_av_core_adapter_plan/implementation/193_worker_linux_build.md`). The definition in this folder was not changed for it. Still a container result, and still not possible here: the worker's fixture runs (`test-fixtures/*.py`, `make e2e`). They ask for `lsof` (not in the image), for `ffmpeg` and `ffprobe` on the search path (they lie in `/opt/dems/ffmpeg-9.0.2/bin`), for an H.264 encoder (this FFmpeg build has none that works without hardware), and `make fixtures` does not compile here (three compile lines of the worker's build file have no feature-test macro). Those are the next container row's (141). Also a date-stamped note.

## State after task 4 rows 141 and 79 (2026-10-13)

The definition gained ONE step, for the worker's test fixtures only: `lsof`, `libx264-dev`, `libx265-dev`, and a second build of the same verified FFmpeg 9.0.2 archive with those two encoders, of which only the programs `ffmpeg` and `ffprobe` are kept (`/opt/dems/fixtures-ffmpeg-9.0.2/bin`, linked from `/usr/local/bin`, named by `DEMS_FFMPEG` / `DEMS_FFPROBE`). Its libraries, headers and pkg-config files are removed in the same step: the worker, the relay and the guard link the pinned build under `/opt/dems/ffmpeg-9.0.2` and nothing else, and the loader knows one libavformat (the step checks both). The step adds about 5 minutes to a first build and fetches packages only (no second download of the archive). On a host none of this is installed: the helper of a microphone is the pinned `ffmpeg`, which has the ALSA input and no encoder library.

With it `make fixtures` and `make proof` end 0 in the container and the fixture runs of the worker and the relay run there. They need more than the default container for two things, both stated in the records: the relay makes itself not dumpable, so reading its descriptors and limits from `/proc` (and `lsof` on it) needs `--cap-add SYS_PTRACE`; and the fixtures write under `/opt/dems/core/.cache`, which root must hand to `dems-check` first. Records, with the commands and the image identifier: `docs/2026-10-12_input_av_core_adapter_plan/test/141_container_e11_relay_state.md` and `test/079_linux_container_checks.md`. Container results; a date-stamped note.
