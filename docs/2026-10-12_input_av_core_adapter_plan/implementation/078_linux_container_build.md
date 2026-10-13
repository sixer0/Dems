---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 78
package: WP-14 (milestone M5)
date: 2026-10-13
agent: coder-execution (batch 8, agent C/I)
tier: T3
status: needs-review
---

# Row 78 - Ubuntu 24.04 container definition for check T-4

Status **needs-review**: the definition is delivered and the image builds; inside it the relay and the guard build, the worker does **not** compile, and `make -C apps/capture-worker` ends 2. The failures are findings for the worker's writer (agent W2), not repairs of this row. Rows 79 and 141 have their tools but no worker binary until findings L-1 to L-3 are served.

ALL RESULTS BELOW ARE CONTAINER RESULTS: Ubuntu 24.04 user space, arm64, on the kernel of the virtual machine of this Mac. None settles an item for the production host.

## 1. Delivered

| File | New | What |
|---|---|---|
| `scripts/host/container/Dockerfile.ubuntu-24.04` | yes | the definition (22 steps, one stage, written for the classic builder) |
| `scripts/host/container/build-in-container.sh` | yes | runs inside the container only: versions, the verdict, every build step with its own exit code, the three binaries |
| `scripts/host/container/README.md` | yes | use, pins, tools, the paths inside the image |
| `.dockerignore` (repository root) | yes | the build context: an allow list |
| `delegation_progress/file_requests.md` | appended | six lines L-1 to L-6 |

DECLARED PLACE and why: `scripts/host/container/`, beside the host profile, because the definition is the profile's items `HOST-10` to `HOST-15` made executable and must be read with it. The ignore file lies at the repository root: the docker client here has no buildx (`docker buildx version`: "unknown command"), and the classic builder reads `/.dockerignore` only. DRIVER DECISION 1 (the first claim named a file beside the definition; corrected in `file_claims.md`).

Not touched: `apps/capture-worker` (0 lines; the container builds a copy inside the image, this Mac's `build/` is not in the context and was not written), `apps/core-server`, `packages/`, every existing file of `scripts/`.

## 2. Container runtime (decision C16 (1))

| Question | Answer | Evidence |
|---|---|---|
| Runtime running? | **yes, already**: colima `default`, started by someone else before this row (two containers of another project up for 4 days) | `docker info`: Server Version 29.5.2, Ubuntu 24.04.4 LTS, aarch64, CPUs 4, Total Memory 7.738GiB; `colima list`: `default Running aarch64 4 8GiB 60GiB docker` |
| Started by this row? | no. `colima start` was not run; no privileged prompt, no host setting changed | - |
| Left running | colima and the two containers of the other project, exactly as found. Containers of this row: 0 (every run was `--rm`) | `docker ps -a` after the last run: the same three entries as before |
| Images added, kept local | `dems/capture-linux-check:ubuntu-24.04-ffmpeg-9.0.2` (id `c8ef7251e672`, 1.96 GB), `ubuntu:24.04` (141 MB). Nothing pushed | `docker images` |

Heavy-host lock: taken for the pull and probe (under 1 minute), the image build (08:48 to 08:55 WIB, about 7 minutes) and four short runs; released between them.

## 3. What was fetched, and the pins

| URL | Pin | How the pin was established |
|---|---|---|
| `docker.io/library/ubuntu:24.04` | `sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55` (image created 2026-09-18) | `docker pull` on 2026-10-13, `RepoDigests` |
| `http://ports.ubuntu.com/ubuntu-ports/` (noble, noble-updates, noble-security, noble-backports) | none; installed versions in `/opt/dems/container/packages.txt` of the image | - |
| `https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz` (12,040,788 bytes) | SHA-256 `8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e` | two independent readings that agree: `sha256sum` over the download in a container; the checksum `brew info --json=v2 ffmpeg` states for the same URL on this Mac |
| `https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz.asc` | must verify | `gpg --verify`: `GOODSIG B4322F04D67658D8 FFmpeg release signing key`, `VALIDSIG FCF986EA15E6E293A5644F10B4322F04D67658D8 2026-09-18` |
| `https://ffmpeg.org/ffmpeg-devel.asc` | key fingerprint `FCF986EA15E6E293A5644F10B4322F04D67658D8` (file SHA-256 `397b3becedcd5a98769967ff1ff8501ddc89f8368b8f766e4701377d7dbaabe5`) | the fingerprint is compared by the definition; that it is the publisher's key rests on the TLS download from ffmpeg.org and on the Homebrew cross-check of the archive, no further web of trust (`TRUST_UNDEFINED`) |

Nothing of the repository was uploaded. Runs: `--network none`.

**Build context** (`02_image_build.log:5`: `Sending build context to Docker daemon  2.241MB`). Listing of what arrived, written inside the image (`/opt/dems/container/context-manifest.txt`), read by count:

| Count of paths | Value |
|---|---|
| files in the context | 124 (`apps/capture-worker` 66, `scripts/hardware-acceptance` 37, `scripts/host` 21) |
| under `apps/input-av` | **0** |
| containing `input-av` anywhere | 0 |
| `node_modules`, `.data`, `.cache`, `docs` | 0, 0, 0, 0 |
| `apps/capture-worker/build/` (this Mac's binaries) | 0 |

`apps/input-av` was not opened, listed or stat-ed by this row.

## 4. What the container is, and the versions

| | |
|---|---|
| Distribution, architecture | Ubuntu 24.04.5 LTS, aarch64 (the production host's architecture is not ruled: `HOST-01`; amd64 was not built) |
| Compiler, tools | Ubuntu clang 18.1.3, GNU Make 4.3, pkg-config (pkgconf) 1.8.1, Python 3.12.3, glibc 2.39 |
| `HOST-10` word for word | sufficient for everything the build asked of the system: it brings `libclang-rt-18-dev` (the sanitizer runtime) through the recommended packages |
| What Ubuntu 24.04 packages (plan review F12; profile open point 4) | `ffmpeg` and `libavformat-dev`: **7:6.1.1-3ubuntu5** (FFmpeg 6.1.1 - not the pinned 9.0.2: the hypothesis of `HOST-11` holds in the container); `arping` 2.24-1build2 and `iputils-arping` 3:20240117-1ubuntu0.1 are two different packages (`HOST-18`); the image holds the iputils one |
| FFmpeg built per `HOST-12` | `ffmpeg version 9.0.2`; `configuration: --prefix=/opt/dems/ffmpeg-9.0.2 --enable-shared --disable-static --disable-doc --enable-indev=alsa`; devices line ` DE alsa`; about 4 minutes on 4 virtual processors. The configure line of the profile works as written (profile open point 2, container half). No external codec library: this is a smaller feature set than the Homebrew build the capture series was verified on |
| `HOST-13` | `libavformat.so.63 (libc6,AArch64) => /opt/dems/ffmpeg-9.0.2/lib/libavformat.so.63` |

**`make versions` inside the container** (`03_build_in_container.log:47-53`):

```
63.1.102      libavformat
63.1.102      libavcodec
12.1.102      libavfilter
7.1.102       libswresample
61.1.102      libavutil
/opt/dems/ffmpeg-9.0.2/lib
```

The same five numbers as on this Mac (`pkg-config --modversion` here: 63.1.102, 63.1.102, 12.1.102, 7.1.102, 61.1.102). The pin of `test/static/libavformat.pin` is met; `check.sh src` accepts the library.

## 5. The build inside the container

Command, as `HOST-14` words it, as root from `/opt/dems/core`: `PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig make -C apps/capture-worker`.

**VERDICT: rc 2** (`03_build_in_container.log:150`). `make` stops at its second step (`selftest`). Every step by itself:

| Step | rc | Result line or failure |
|---|---|---|
| `check` (the worker's own check script over `src/`) | **0** | `check.sh: src: static rules OK (...)` - the static rules and the version pin hold on Linux |
| `selftest` | **2** | `check.sh selftest: the two programs of the import-net check did not compile` - every other planted case is refused as required (finding L-2) |
| `unit` | **2** | anchor, micwatch, announce (187 checks) pass; then `test/sink_kill_test.c` and `src/sink.c` do not compile (finding L-1) |
| `build/capture-worker` | **2** | 22 compile errors in five sources (finding L-1). **The binary is absent** |
| `relay-check` | 0 | static rules OK; 36 planted cases refused, among them the import and hardening controls |
| `relay-unit` | **2** | `Aborted (core dumped)`, exit 134 (finding L-5) |
| `relay-asan` | **2** | `Aborted`, exit 134, the same cause (finding L-5) |
| `relay-fuzz` | 0 | `605120 inputs over 8 entry point(s) in 16.0 s, seed 186: 0 failures` |
| `build/capture-relay` | 0 | compiled with `-pie -Wl,-z,relro,-z,now` (the Linux-only flags the Makefile called unproven); `relay-check.sh: build/capture-relay: import net OK` |
| `build/capture-guard`, `guard_double` | 0 | compiled with the same hardening |
| `guard` | 0 | `guard_test: all 83 checks hold (child gone after the guard's input ended: 15 to 19 ms over 20 runs, bound 500 ms; after a SIGKILL of the guard's parent: at most 70 ms over 6 runs; a child that ignores SIGTERM: killed after 2015 ms; orphans: 0)` - the `__linux__` seam compiled and ran for the first time |

**The three programs** (`03_build_in_container.log:513-527`):

| Program | Present | What it is | Links | Hardening read from the binary |
|---|---|---|---|---|
| `capture-worker` | **ABSENT** | - | - | - |
| `capture-relay` | yes, 235,856 bytes | ELF 64-bit PIE, aarch64 | `libavformat.so.63`, `libavcodec.so.63`, `libavutil.so.61` (and `libswresample.so.7` through them), all under `/opt/dems/ffmpeg-9.0.2/lib` | type DYN, 1 GNU_RELRO segment, BIND_NOW, stack check imported, 2 fortified copies |
| `capture-guard` | yes, 80,976 bytes | ELF 64-bit PIE, aarch64 | no FFmpeg library | type DYN, 1 GNU_RELRO segment, BIND_NOW, stack check imported |

No program prints a version of its own: none has a version switch (finding L-6). The versions are those of `make versions` and of `ldd`.

### Findings (each routed in `file_requests.md`; none repaired here)

| # | Kind | Where | Failure, in one line |
|---|---|---|---|
| L-1 | compiler / C library | `apps/capture-worker/Makefile:47` | the worker's `-std=c11` has no feature-test macro: glibc hides `clock_gettime`, `nanosleep`, `sigaction`, `lstat`, `ftruncate`, `getdtablesize`, `O_CLOEXEC`, `O_DIRECTORY` - 22 errors in `capture_worker.c` (4), `ipc.c` (5), `sink.c` (7), `ingest.c` (2), `audio.c` (4), and 7 in `test/sink_kill_test.c` |
| L-2 | static rule that is macOS-specific | `apps/capture-worker/check.sh:259` | the selftest's planted program names the label `_creat` (Mach-O spelling): `undefined reference to '_creat'` on ELF |
| L-3 | static rule that is macOS-specific (behind L-1) | `apps/capture-worker/test/static/pinned_calls.py:326-330` | the import reader does not cut the ELF version suffix (`open@GLIBC_2.17`): all six pins are called stale and the binary is removed |
| L-4 | platform behaviour (behind L-1) | `apps/capture-worker/test/writer_test.c:452`, `:467`, `:472` | the sink states `FSYNC` on Linux; 5 sync-level checks expect `F_FULLFSYNC` (host profile open point 1, check `9A/H-03`) |
| L-5 | test harness, kernel limit | `apps/capture-worker/test/relay_unit_test.c:1053-1062` | the socket pair takes 438,528 of 612,760 bytes (`SO_SNDBUF` capped), then `abort()`; the message is lost unflushed |
| L-6 | profile | `HOST-15` | "each program states the library version" has no command: no version switch exists |

### What-if runs (labelled; on a throw-away copy inside a container; NOT results of the tree)

Made to see what stands behind the first failures, so that the worker's writer gets the whole list in one pass. No file of the repository was changed for them.

| Run | Change, in the copy only | Outcome | Log |
|---|---|---|---|
| W1 | `-D_DEFAULT_SOURCE` added to the worker's flags on the make command line | compiles and links with 0 errors against libavformat 63.1.102; the binary holds the string `capture-worker/0.6.0`; then the import net removes it (L-3) | `06_what_if.txt` |
| W1b | the same link without the import net | `nm -u` with the version suffix cut: `fopen ftruncate link open rename unlink` - exactly the six names of `test/static/imports.pin`, no other file-making function | `06_what_if.txt` |
| W2 | `make unit` with the flag | `sink_kill_test: 200 kills in 8.4 s ... violations 0`; then `writer_test: 5 check(s) FAILED` (L-4) | `06_what_if.txt` |
| W3b | forced socket buffer sizes in the copy of the TEST file; capability NET_ADMIN in the container | `relay_unit_test: 590 checks passed; ... 34 of 34 pass`; under the sanitizers the same, and the three negative controls fail as required | `07_what_if_relay_unit.txt` |
| W4 | the label of L-2 as `creat` | the program links | `06_what_if.txt` |

W3 (the same without the capability) aborted as before: forcing the size needs the capability. Not looked at: what stands behind L-4 in `make unit` (`start_checks.sh`, `log_test`), because `make` stops there.

## 6. Verification cells of the row

| Cell | Result |
|---|---|
| a container runtime is present on this Mac | yes (section 2); not `blocked: NO_CONTAINER_RUNTIME` |
| the three programs build | **2 of 3**: relay and guard yes, worker no (L-1) |
| the worker's own check script passes | `check.sh src`: yes, rc 0. Its selftest: no (L-2) |
| all recorded as container results | yes; logs under `.cache/task4-row078/` (untracked): `01_probe.txt`, `02_image_build.log`, `03_build_in_container.log`, `04_context_and_packages.txt`, `05_relay_unit_diagnosis.txt`, `06_what_if.txt`, `07_what_if_relay_unit.txt`; the same build log inside the image at `/opt/dems/container/build.log` |
| the image builds | yes: `Successfully built c8ef7251e672` |
| `make -C apps/capture-worker` rc 0, or the exact failures recorded | rc 2; failures in section 5 |
| build context excludes `apps/input-av` | 0 paths of 124 (section 3) |

## 7. Tools for rows 79 and 141, and what they still lack

In the image: `procps`, `psmisc`, `util-linux` (`prlimit`, `setpriv`), `iputils-arping`, `iproute2`, `alsa-utils`, the pinned `ffmpeg` with the ALSA input, `strace`, `file`, `binutils`, `python3`, an account `dems-check` without rights; the worker's fixtures and `scripts/hardware-acceptance/` (with `e11b-announce-probe`) in the tree.

- Row 79 can run its guard half now (survivors with and without the guard; the short process name; the packages of HA-13: read in section 4). The relay binary exists.
- Row 141 (the announce line of branch B on the Linux library, BR-10; the BR-09 cases) needs a **worker** built in the container: blocked on L-1, L-2 and L-3. The relay's process state (core-file limit, no new privileges) can be read as soon as a relay is run.
- Not in the image: Node.js. A check that needs the Core's own code in the container has to add it.

## 8. Unproven, and where it is settled

- Everything on the real host: `9A/H-01` (build on the host's architecture and kernel), `9A/H-03` (the sync level on the evidence disk, L-4), `9A/H-02` and `9A/H-24` (survivors under the real service manager).
- amd64: not built.
- The worker on Linux at run time: nothing, there is no binary.
- The feature set of this FFmpeg build against the capture series: the series did not run (`make e2e` is not part of `make`, and needs the worker).

## 9. Rules kept

Edit tool only for existing files (two: `file_claims.md`, `file_requests.md`); new files with Write. Nothing committed. No full suite. No port bound on the host. Heavy-host lock per build and per run. No file of `apps/capture-worker`, `apps/core-server` or `packages/` written. DRIVER DECISION 2: the build of the three programs is a step of the image that never fails the image (its log and exit code are kept inside), so that a red build leaves a usable tool image and a reproducible record. DRIVER DECISION 3: the what-if runs of section 5, on copies inside containers, one of them with the capability NET_ADMIN inside the container's own network namespace.
