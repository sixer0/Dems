# DEMS Core: production image for Ubuntu 24.04 (task 4 row DK, decision C156). STATUS: UNVERIFIED.
#
# WHAT IT IS. One image that carries, at the host profile's proposed paths:
#   /opt/dems/core            the product tree (root-owned, HOST-05): the Core server (apps/core-server), the web
#                             console sources and its development server (apps/core-web), packages/shared,
#                             packages/capture-protocol, apps/transcriber, with their npm dependencies
#   /opt/dems/core/apps/capture-worker/build/{capture-worker,capture-relay,capture-guard}
#                             built here by the worker's own build file (HOST-14, HOST-15)
#   /opt/dems/ffmpeg-9.0.2    FFmpeg 9.0.2 built from the verified release archive (HOST-12, HOST-13)
#   /opt/dems/node            Node.js 26.8.2, the official Linux archive held to a pinned SHA-256 (HOST-09)
#   /opt/dems/container       the records of this build (what was fetched, configured, built and installed)
#
# WHAT IT IS NOT. Not verified: the tree is the work-in-progress checkpoint named in BUILD-INFO.txt, on which only
# the TypeScript compile check ran; no test suite ran on it. A container is NOT the hardened Linux host of
# scripts/host/HOST-PROFILE-UBUNTU-24.04.md (HOST-21 even forbids a container runtime on that host). Not in the
# image: any key, password, credential, signing key or operator account; the address helper
# (scripts/host/netalias/, a root service of the HOST); the GPL fixture FFmpeg of the check container.
#
# BUILD with deploy/docker/build-image.sh (it stages a context of tracked files and refuses to build when the
# verbatim block below differs from its source). Written for the classic builder (no buildx on the development
# Mac): no mounts, no here-documents, platform found with dpkg, not with TARGETARCH.
#
# STAGE 0 (unnamed; later stages name it `--from=0`): lines 30 to 107 of
# scripts/host/container/Dockerfile.ubuntu-24.04, VERBATIM - the pinned base image, HOST-10, the record of the
# distribution's candidates, the fetch tools, HOST-12 FFmpeg 9.0.2 (pinned SHA-256 AND a valid signature of the
# pinned release key), HOST-13, the took-effect checks, the tools of the later container rows, the HOST-11 and
# HOST-18 checks and the package list. NOT taken from that file: its `dems-check` account, its second (GPL, x264 and
# x265) FFmpeg for the test fixtures, its tree copy and build-in-container.sh.
# >>> BEGIN VERBATIM scripts/host/container/Dockerfile.ubuntu-24.04 lines 30-107
FROM ubuntu:24.04@sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55

ARG DEBIAN_FRONTEND=noninteractive

# The record folder of this image: what was installed, how FFmpeg was configured, what was sent as context,
# and the log and exit code of the build of the three programs.
RUN mkdir -p /opt/dems/container

# HOST-10, the profile's package list WORD FOR WORD (recommended packages included, as on a host where the
# installer types the profile's command). If this list is not enough for `make`, that is a finding against
# the profile and is recorded - it is not papered over here.
RUN apt-get update \
 && apt-get install -y build-essential clang make pkg-config python3 nasm libasound2-dev

# What Ubuntu 24.04 itself carries (profile section 5, open point 4; plan review finding F12), read from the
# package index, nothing installed: the distribution's FFmpeg and the two packages named arping.
RUN apt-cache policy ffmpeg libavformat-dev arping iputils-arping > /opt/dems/container/apt-candidates.txt \
 && cat /opt/dems/container/apt-candidates.txt

# Tools of THIS definition only (not items of the profile): fetching and verifying the FFmpeg archive.
RUN apt-get install -y --no-install-recommends ca-certificates curl gnupg xz-utils

# HOST-12: FFmpeg 9.0.2 from the release source, with the ALSA input, as shared libraries.
# The archive is held to a pinned SHA-256 AND to a good signature of the pinned release key.
# The SHA-256 was read twice on 2026-10-13 from independent places and agreed: computed over the archive
# downloaded from ffmpeg.org, and the checksum the Homebrew formula of FFmpeg 9.0.2 states for the same URL.
ARG FFMPEG_VERSION=9.0.2
ARG FFMPEG_SHA256=8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e
ARG FFMPEG_KEY_FINGERPRINT=FCF986EA15E6E293A5644F10B4322F04D67658D8
ARG FFMPEG_PREFIX=/opt/dems/ffmpeg-9.0.2
RUN set -eu \
 && mkdir -p /usr/local/src/ffmpeg && cd /usr/local/src/ffmpeg \
 && curl -fsSLO "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz" \
 && curl -fsSLO "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz.asc" \
 && curl -fsSLO "https://ffmpeg.org/ffmpeg-devel.asc" \
 && echo "${FFMPEG_SHA256}  ffmpeg-${FFMPEG_VERSION}.tar.xz" | sha256sum -c - \
 && export GNUPGHOME="$(mktemp -d)" \
 && gpg --batch --quiet --import ffmpeg-devel.asc \
 && gpg --batch --status-fd 1 --verify "ffmpeg-${FFMPEG_VERSION}.tar.xz.asc" "ffmpeg-${FFMPEG_VERSION}.tar.xz" > verify.status 2>verify.err \
 && grep -q "^\[GNUPG:\] VALIDSIG ${FFMPEG_KEY_FINGERPRINT} " verify.status \
 && { gpgconf --kill all || true; } && rm -rf "$GNUPGHOME" \
 && tar -xf "ffmpeg-${FFMPEG_VERSION}.tar.xz" \
 && cd "ffmpeg-${FFMPEG_VERSION}" \
 && ./configure --prefix="${FFMPEG_PREFIX}" --enable-shared --disable-static --disable-doc --enable-indev=alsa \
 && make -j"$(nproc)" \
 && make install \
 && cp ffbuild/config.log /opt/dems/container/ffmpeg-config.log \
 && cd .. && rm -rf "ffmpeg-${FFMPEG_VERSION}" \
 && sha256sum "ffmpeg-${FFMPEG_VERSION}.tar.xz" ffmpeg-devel.asc > /opt/dems/container/ffmpeg-source.sha256 \
 && cat verify.status >> /opt/dems/container/ffmpeg-source.sha256

# HOST-13: the dynamic loader finds the pinned libraries (file A of the profile).
RUN echo "${FFMPEG_PREFIX}/lib" > /etc/ld.so.conf.d/dems-ffmpeg.conf \
 && ldconfig \
 && ldconfig -p | grep -q "libavformat.so.63 .*=> ${FFMPEG_PREFIX}/lib/"

# The took-effect checks of HOST-12, as the profile words them.
RUN "${FFMPEG_PREFIX}/bin/ffmpeg" -hide_banner -version | head -n 1 | grep -q "ffmpeg version ${FFMPEG_VERSION} " \
 && "${FFMPEG_PREFIX}/bin/ffmpeg" -hide_banner -version | grep -q "libavformat *63\. *1\.102" \
 && "${FFMPEG_PREFIX}/bin/ffmpeg" -hide_banner -devices 2>/dev/null | grep -q "^ D. alsa "

# Tools the later container rows need (rows 79 and 141), none of them an item the build depends on:
#   procps, psmisc     the process table: short names, full paths, survivors after a killed parent (HA-11, HA-12)
#   util-linux         prlimit, setpriv (in the base image; named here for the reader)
#   iputils-arping     the conflict-check tool of HOST-18 (HA-13); iproute2 beside it
#   alsa-utils         arecord / aplay and the `null` and `file` devices for the helper's argument list
#   strace, file       what a process does at an instant; what a binary is
# The sanitizer runtime of clang is NOT named here on purpose: whether HOST-10 brings it is part of the result.
RUN apt-get install -y --no-install-recommends procps psmisc iproute2 iputils-arping alsa-utils strace file

# HOST-11 and HOST-18 hold in this image: no FFmpeg development package of the distribution, and not the
# other package named arping. Then the list of what is installed.
RUN ! dpkg -s libavformat-dev >/dev/null 2>&1 \
 && ! dpkg -s libavcodec-dev >/dev/null 2>&1 \
 && ! dpkg -s ffmpeg >/dev/null 2>&1 \
 && ! dpkg -s arping >/dev/null 2>&1 \
 && dpkg -S "$(command -v arping)" \
 && dpkg-query -W -f '${Package}\t${Version}\t${Architecture}\n' > /opt/dems/container/packages.txt
# <<< END VERBATIM

# HOST-14 and HOST-15: the worker, the relay and the guard, by the worker's own build file, against the pinned FFmpeg.
COPY apps/capture-worker /opt/dems/core/apps/capture-worker
WORKDIR /opt/dems/core
ENV PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig

# (1) THE VERDICT, recorded and NOT required: `make -C apps/capture-worker` as HOST-14 words it (static rules, their
#     self-test, unit checks, the relay's checks with the AddressSanitizer build and the fuzz run, the guard test).
#     Under an emulated processor (qemu, an amd64 image built on an arm64 machine) the sanitizer steps can fail for
#     the emulator's sake; the log and the exit code are kept in the image either way.
RUN timeout 5400 make -C apps/capture-worker > /opt/dems/container/worker-make-all.log 2>&1; \
    echo "$?" > /opt/dems/container/worker-make-all.rc; \
    echo "make -C apps/capture-worker: exit $(cat /opt/dems/container/worker-make-all.rc)"; \
    tail -n 30 /opt/dems/container/worker-make-all.log; true

# (2) REQUIRED, the image fails without it: the worker's static rules, their self-test and unit checks, the relay's
#     static rules and unit checks, and the three programs, each with the import check its rule runs after the link.
RUN make -C apps/capture-worker check selftest unit relay-check relay-unit \
         build/capture-worker build/capture-relay build/capture-guard \
         > /opt/dems/container/worker-make-required.log 2>&1 \
 || { tail -n 80 /opt/dems/container/worker-make-required.log; exit 1; }
RUN cd apps/capture-worker/build \
 && for p in capture-worker capture-relay capture-guard; do \
      test -x "$p" || exit 1; \
      printf '%s\t%s bytes\tsha256 %s\n' "$p" "$(stat -c %s "$p")" "$(sha256sum "$p" | cut -d' ' -f1)"; \
    done > /opt/dems/container/worker-programs.txt \
 && cat /opt/dems/container/worker-programs.txt \
 && ldd capture-worker | grep -q "libavformat.so.63 => /opt/dems/ffmpeg-9.0.2/lib/"

# ---------------------------------------------------------------------------------------------------------------
# STAGE nodedeps: Node.js 26.8.2 (HOST-09) and the npm dependencies of the five workspaces the Core needs.
# The archive's SHA-256 is pinned per processor; both were read on 2026-10-14 from
# https://nodejs.org/dist/v26.8.2/SHASUMS256.txt and agreed with the copy the release packager fetched earlier
# (.cache/release/node-v26.8.2/SHASUMS256.txt, same file hash). The signature of SHASUMS256.txt is not checked.
FROM ubuntu:24.04@sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55 AS nodedeps
ARG DEBIAN_FRONTEND=noninteractive
ARG NODE_VERSION=26.8.2
ARG NODE_SHA256_X64=40e1d3225c1c9ae9a2671c98ecb9857e4d5555026394f348645676798840d5c5
ARG NODE_SHA256_ARM64=81d8f0fdea9dcd3bfdcfeafc5f8359c151f097e9880b0007c0645ca670d07971
# libatomic1: the official Node.js Linux binary links it; the minimal Ubuntu image does not carry it.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl xz-utils libatomic1
RUN set -eu \
 && arch="$(dpkg --print-architecture)" \
 && case "$arch" in \
      amd64) nodearch=x64;   sum="${NODE_SHA256_X64}" ;; \
      arm64) nodearch=arm64; sum="${NODE_SHA256_ARM64}" ;; \
      *) echo "no pinned Node.js archive for $arch"; exit 1 ;; \
    esac \
 && file="node-v${NODE_VERSION}-linux-${nodearch}.tar.xz" \
 && cd /tmp && curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/${file}" \
 && echo "${sum}  ${file}" | sha256sum -c - \
 && mkdir -p /opt/dems/node \
 && tar -xJf "${file}" -C /opt/dems/node --strip-components=1 --no-same-owner \
 && rm -f "${file}" \
 && /opt/dems/node/bin/node --version | grep -qx "v${NODE_VERSION}" \
 && echo "${sum}  ${file}" > /opt/dems/node/DEMS-ARCHIVE.sha256
ENV PATH=/opt/dems/node/bin:$PATH
WORKDIR /opt/dems/core
# The manifests first, so that a change of the sources does not repeat the install. apps/mobile and apps/mock-core
# are present as manifests ONLY, so that the lock file matches its workspaces; nothing of them is installed.
COPY package.json package-lock.json .npmrc .node-version tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/capture-protocol/package.json packages/capture-protocol/
COPY apps/transcriber/package.json apps/transcriber/
COPY apps/core-server/package.json apps/core-server/
COPY apps/core-web/package.json apps/core-web/
COPY apps/mobile/package.json apps/mobile/
COPY apps/mock-core/package.json apps/mock-core/
# --ignore-scripts: the root `postinstall` patches the mobile app, which is not here; no package of these five
# workspaces needs an install script to run (esbuild and the bundler ship their binaries as platform packages).
RUN npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/npm-cache \
        -w @dems/shared -w @dems/capture-protocol -w @dems/transcriber -w @dems/core-server -w @dems/core-web \
 && rm -rf /tmp/npm-cache
COPY . /opt/dems/core/
RUN rm -rf apps/mobile apps/mock-core \
 && test ! -e apps/input-av && test ! -e .data && test ! -e docs \
 && ./node_modules/.bin/tsx --version \
 && (cd apps/core-web && node -e "require.resolve('vite/package.json')" && test -x "$(node -p "require('path').join(require('path').dirname(require.resolve('vite/package.json')),'bin','vite.js')")")

# ---------------------------------------------------------------------------------------------------------------
# STAGE runtime: what is shipped.
FROM ubuntu:24.04@sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55
ARG DEBIAN_FRONTEND=noninteractive
ARG DEMS_BASE_COMMIT=unknown
LABEL org.opencontainers.image.title="DEMS Core (UNVERIFIED)" \
      org.opencontainers.image.description="DEMS Core server, web console development server, capture worker/relay/guard, FFmpeg 9.0.2 - task 4 work-in-progress checkpoint, compile-checked only, NOT TESTED" \
      org.opencontainers.image.revision="${DEMS_BASE_COMMIT}" \
      org.opencontainers.image.base.name="ubuntu:24.04@sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55" \
      dems.verification="UNVERIFIED"

# Runtime packages. libasound2t64: the ALSA library the pinned FFmpeg links. alsa-utils: /usr/bin/arecord, the fixed
# card-listing program (HOST-26). iputils-arping + iproute2 (HOST-18), iputils-ping (profile section 3.11), procps
# (HOST-17), util-linux (setpriv, used by the entrypoint to drop to the service account), libatomic1 (Node.js).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates libatomic1 libasound2t64 alsa-utils iproute2 iputils-arping iputils-ping procps util-linux \
 && rm -rf /var/lib/apt/lists/* \
 && ! dpkg -s ffmpeg >/dev/null 2>&1 && ! dpkg -s libavformat-dev >/dev/null 2>&1 && ! dpkg -s arping >/dev/null 2>&1 \
 && dpkg -S /usr/bin/arping | grep -q '^iputils-arping: ' \
 && dpkg -S /usr/bin/arecord | grep -q '^alsa-utils: '

# The pinned FFmpeg without its headers and pkg-config files (nothing is compiled here), and its loader entry (HOST-13).
COPY --from=0 /opt/dems/ffmpeg-9.0.2 /opt/dems/ffmpeg-9.0.2
COPY --from=0 /etc/ld.so.conf.d/dems-ffmpeg.conf /etc/ld.so.conf.d/dems-ffmpeg.conf
COPY --from=0 /opt/dems/container /opt/dems/container/build-stage
COPY --from=nodedeps /opt/dems/node /opt/dems/node
COPY --from=nodedeps /opt/dems/core /opt/dems/core
COPY --from=0 /opt/dems/core/apps/capture-worker/build/capture-worker /opt/dems/core/apps/capture-worker/build/capture-worker
COPY --from=0 /opt/dems/core/apps/capture-worker/build/capture-relay /opt/dems/core/apps/capture-worker/build/capture-relay
COPY --from=0 /opt/dems/core/apps/capture-worker/build/capture-guard /opt/dems/core/apps/capture-worker/build/capture-guard
ENV PATH=/opt/dems/node/bin:$PATH

# Ownership (HOST-05: the tree, Node and FFmpeg belong to root and are not writable by group or others), the two
# accounts, and the only writable places: the data directory and the error log folder (dems-core), the console
# server's dependency cache (dems-console). The data directory is fixed by the Core's code to <tree>/.data
# (apps/core-server/src/plugins/config/load-config.ts, DEFAULT_DATA_DIR); the error log to apps/core-server/logs.
RUN rm -rf /opt/dems/ffmpeg-9.0.2/include /opt/dems/ffmpeg-9.0.2/lib/pkgconfig \
 && ldconfig && ldconfig -p | grep -q "libavformat.so.63 .*=> /opt/dems/ffmpeg-9.0.2/lib/" \
 && chown -R root:root /opt/dems && chmod -R go-w /opt/dems \
 && groupadd --system --gid 10001 dems-core \
 && useradd --system --uid 10001 --gid dems-core --groups audio --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin dems-core \
 && groupadd --system --gid 10002 dems-console \
 && useradd --system --uid 10002 --gid dems-console --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin dems-console \
 && install -d -o dems-core -g dems-core -m 0700 /opt/dems/core/.data /opt/dems/core/.data/media /opt/dems/core/.data/media/sessions /opt/dems/core/apps/core-server/logs \
 && install -d -o root -g root -m 0755 /opt/dems/core/apps/core-web/node_modules \
 && install -d -o dems-console -g dems-console -m 0700 /opt/dems/core/apps/core-web/node_modules/.vite \
 && install -o root -g root -m 0755 /opt/dems/core/deploy/docker/rootfs/opt/dems/docker/dems-entrypoint.sh /usr/local/bin/dems-entrypoint \
 && install -o root -g root -m 0644 /opt/dems/core/.dems-build-info.txt /opt/dems/container/BUILD-INFO.txt

# The took-effect checks of this image. Nothing of the address helper, no key and no credential file is in it.
RUN set -eu \
 && node --version | grep -qx v26.8.2 \
 && /opt/dems/ffmpeg-9.0.2/bin/ffmpeg -hide_banner -version | head -n 1 | grep -q "ffmpeg version 9.0.2 " \
 && /opt/dems/ffmpeg-9.0.2/bin/ffmpeg -hide_banner -version | grep -q "libavformat *63\. *1\.102" \
 && /opt/dems/ffmpeg-9.0.2/bin/ffmpeg -hide_banner -devices 2>/dev/null | grep -q "^ D. alsa " \
 && for p in /opt/dems/core/apps/capture-worker/build/capture-worker /opt/dems/core/apps/capture-worker/build/capture-relay \
             /opt/dems/core/apps/capture-worker/build/capture-guard /opt/dems/ffmpeg-9.0.2/bin/ffmpeg; do \
      ! ldd "$p" | grep -q "not found" || { ldd "$p"; exit 1; }; done \
 && ldd /opt/dems/core/apps/capture-worker/build/capture-worker | grep -q "libavformat.so.63 => /opt/dems/ffmpeg-9.0.2/lib/" \
 && test -z "$(find / -xdev \( -name 'dems-core-netalias*' -o -name 'pg.env' -o -name 'pg.owner.env' -o -name 'pg.pwfile' \
              -o -name '*.p8' -o -name '*.wrap' -o -name '*.keystore' -o -name '*.jks' \) -print 2>/dev/null)" \
 && test -z "$(find /opt/dems/core/.data ! -type d -print)" \
 && cd /opt/dems/core && ./node_modules/.bin/tsx --version > /dev/null \
 && dpkg-query -W -f '${Package}\t${Version}\t${Architecture}\n' > /opt/dems/container/runtime-packages.txt \
 && { echo "architecture: $(dpkg --print-architecture)"; node --version; /opt/dems/ffmpeg-9.0.2/bin/ffmpeg -hide_banner -version | head -n 1; \
      cat /opt/dems/container/build-stage/worker-programs.txt; echo "worker make (all) exit: $(cat /opt/dems/container/build-stage/worker-make-all.rc)"; } \
      > /opt/dems/container/IMAGE-FACTS.txt \
 && cat /opt/dems/container/IMAGE-FACTS.txt

WORKDIR /opt/dems/core
ENV npm_config_cache=/tmp/npm-cache npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
STOPSIGNAL SIGTERM
# The entrypoint starts as root ONLY to hand the data directory to dems-core and to write the database connection
# file from a mounted secret; it then drops to dems-core (or dems-console) with no capability, an empty bounding set
# and no new privileges. Modes: `core` (default), `console`, or a script name of apps/core-server (`db:migrate`, ...).
ENTRYPOINT ["/usr/local/bin/dems-entrypoint"]
CMD ["core"]
