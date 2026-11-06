---
task_id: 2026-10-21_bare_metal_bench
row: 3
date: 2026-10-22
agent: explore
scope: Q5 - build commands, output paths, FFmpeg pkg-config expectations of capture worker, relay, guard (read-only, code only)
---

# Q5: capture worker / relay / guard build (Tier 2)

Method: direct reading (grep/sed); graft not used. All paths relative to repo root. Nothing was built or run.

## 1. One build command per program

There is NO install target (`grep install` in Makefile: only the header comment "installs nothing", Makefile:2). Output goes to `apps/capture-worker/build/` (Makefile:2, :56). One Makefile, run from the repo root: `make -C apps/capture-worker` (Makefile:3).

| Program | Single-target command | Rule (file:line) | Output |
|---|---|---|---|
| capture-worker | `make -C apps/capture-worker build/capture-worker` | `$(BIN): $(SRC) ...` Makefile:~191 (`$(CC) $(CFLAGS) -o $@ $(SRC) $(LDLIBS)`); BIN Makefile:57; SRC (8 files) :58 | `apps/capture-worker/build/capture-worker` |
| capture-relay | `make -C apps/capture-worker build/capture-relay` | `$(RELAY_BIN): ...` Makefile:~186-189 (`$(CC) $(RELAY_CFLAGS) -o $@ $(RELAY_SRC) $(RELAY_HARDEN_LD) $(RELAY_LDLIBS)`); RELAY_BIN :97; RELAY_SRC :98 (src/relay/relay.c, relay_rtsp.c, relay_core.c) | `.../build/capture-relay` |
| capture-guard | `make -C apps/capture-worker build/capture-guard` | `$(GUARD_BIN): $(GUARD_SRC) Makefile` Makefile:135-137 (`$(CC) $(GUARD_CFLAGS) -o $@ $(GUARD_SRC) $(RELAY_HARDEN_LD)`); GUARD_BIN :124; GUARD_SRC :125 (src/guard/guard.c) | `.../build/capture-guard` |

Aggregate targets: `make -C apps/capture-worker` = `all: check selftest unit $(BIN) relay guard` (Makefile:130). `make relay` = relay-check relay-unit relay-asan relay-fuzz + binary (:144). `make guard` builds binary + double and runs `python3 test/guard_test.py all` (:132-133). npm wrappers: root package.json:58 `test:capture-worker` = `make -C apps/capture-worker`; :59 `test:capture-worker-e2e` = `make -C apps/capture-worker e2e`. No build script in an apps/capture-worker package.json (none exists).

Post-link gates (binary is deleted if they fail): worker `python3 test/static/pinned_calls.py --imports $@ test/static/imports.pin` (Makefile:~192); relay `sh relay-check.sh --imports $@` (:~189). Static rules run first via `check` (check.sh) and refuse the build on a wrong libavformat version (check.sh:375).

## 2. FFmpeg pkg-config expectations

- Worker modules: `LIBS_PC := libavformat libavcodec libavfilter libswresample libavutil` (Makefile:44); flags via `$(PKG_CONFIG) --cflags/--libs` (:53-54), plus `-lm -lpthread`.
- Relay modules: `RELAY_PC := libavformat libavcodec libavutil` (:100) - three libs, not five (comment :72-73). Unit/fuzz link only `libavutil` (:113).
- Guard: no library at all, "no library but the system's" (comment :119-120); flags from RELAY_HARDEN only (:126).
- How the build finds them: plain `pkg-config` (`PKG_CONFIG ?= pkg-config`, :43; overridable by env). No prefix is baked into the Makefile. A non-system FFmpeg is found only through the caller's `PKG_CONFIG_PATH`: `PKG_CONFIG_PATH=<ffmpeg-prefix>/lib/pkgconfig make -C apps/capture-worker` (scripts/host/HOST-PROFILE-UBUNTU-24.04.md:71 HOST-14; deploy/docker/Dockerfile:113 `ENV PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig`; scripts/host/container/build-in-container.sh:21). Runtime loader needs `/etc/ld.so.conf.d/dems-ffmpeg.conf` containing `<prefix>/lib` plus `ldconfig` (HOST-13, HOST-PROFILE:70, :57-62; Dockerfile:82); verification `ldd .../capture-worker` resolves `libavformat.so.63` under the prefix (HOST-PROFILE:71; Dockerfile:136).
- `make versions` prints `pkg-config --modversion` of the five modules and the libdir (Makefile:293-295).

## 3. Version pin

- `apps/capture-worker/test/static/libavformat.pin:6`: `libavformat	63.1.102	9.0.2` (pkg-config version, FFmpeg release). Header: PRFT on every packet is relied on by ingest.c; another version refused at build (pin file :1-4).
- Enforced: check.sh:218-225 `version_rule` (compares `pkg-config --modversion libavformat`, check.sh:375); relay pin = worker's pin (relay-check.sh:157-159); header guard in src/ingest.c:56 (`#include <libavformat/version.h>`, comment :74-77).
- Packaged build: Dockerfile:56-59 `FFMPEG_VERSION=9.0.2`, `FFMPEG_SHA256=8c385028...e002e`, key fingerprint FCF986EA15E6E293A5644F10B4322F04D67658D8, `FFMPEG_PREFIX=/opt/dems/ffmpeg-9.0.2`; configure line Dockerfile:73 and HOST-PROFILE:46: `./configure --prefix=<prefix> --enable-shared --disable-static --disable-doc --enable-indev=alsa`, then `make -j"$(nproc)"`, `make install` (Dockerfile:74-75). Distribution FFmpeg must be absent (HOST-11; Dockerfile:100-104). Hypothesis H-01 recorded in 30-runtime-media.sh:41: Ubuntu 24.04 packages FFmpeg 6.1, which the worker refuses.

## 4. Toolchain requirements stated

- Compiler hard-coded `CC := clang` (Makefile:42; HOST-PROFILE:71 notes it). C11: `-std=c11 -D_DEFAULT_SOURCE -O2 -g -Wall -Wextra -Werror` (:52). `-D_DEFAULT_SOURCE` needed on Linux/glibc for POSIX functions (:47-51).
- Relay and guard hardening: `-U_FORTIFY_SOURCE -D_FORTIFY_SOURCE=2 -fstack-protector-strong -fPIE` (:101); on Linux also `-pie -Wl,-z,relro,-z,now` (:102-105). Worker has no hardening flags.
- Other tools used by the targets: `python3` (check.sh, pinned_calls.py, guard_test.py), `make`, `pkg-config`, `nasm` + `libasound2-dev` (FFmpeg ALSA build). Host package line HOST-10: `sudo apt-get install -y build-essential clang make pkg-config python3 nasm libasound2-dev` (30-runtime-media.sh:28; Dockerfile:42).
- `make relay-asan` / `relay-fuzz` need clang's ASan/UBSan runtime; "NOT named on purpose ... whether HOST-10 brings it is part of the result" (Dockerfile:97; build-in-container.sh:47; Makefile:86-87). Full `make` therefore may fail at sanitizer steps on a bare host; the three single-target builds in section 1 avoid those targets (Dockerfile:126-128 uses exactly `check selftest unit relay-check relay-unit build/capture-worker build/capture-relay build/capture-guard` as the REQUIRED set).
- Reference toolchain evidence: apps/capture-worker/README.md:182 "clang 18, glibc 2.39, a self-built FFmpeg 9.0.2" in an Ubuntu 24.04 container; stated as settling nothing for the production host.
- Install/output path in packaged form: `/opt/dems/core/apps/capture-worker/build/{capture-worker,capture-relay,capture-guard}` (Dockerfile:7, :215-217); Core env keys naming them: `DEMS_CAPTURE_WORKER`, `DEMS_CAPTURE_RELAY`, `DEMS_CAPTURE_GUARD`, `DEMS_CAPTURE_AUDIO_HELPER=<prefix>/bin/ffmpeg` (HOST-PROFILE:111, :73). Binaries must sit under root-owned paths (HOST-05, HOST-15).

## Unknowns / not verified
- Whether clang on the bench host (Ubuntu 24.04, clang 18 expected) ships the sanitizer runtime; only measurable on the host (row 6/7 scope).
- Line numbers marked `~` (Makefile 186-192) were read from grep context, not an exact single-line quote; re-confirm before citing in a spec.
- HOST-14 itself says the import list was fixed on macOS and "may differ on glibc" (HOST-PROFILE:71): unproven on Linux outside the container.
