#!/bin/bash
# DEMS Core host profile, part 3: runtime, the pinned media library, the capture programs
# (HOST-09 to HOST-17). Items of scripts/host/HOST-PROFILE-UBUNTU-24.04.md, section 3.3.
# Print-only by default. --apply (root, Ubuntu 24.04) runs the AUTO steps. Downloads, checksum
# comparisons and builds stay the user's: no mode of this script fetches or builds anything.
# UNPROVEN ON LINUX.
set -eu
HP_SCRIPT=30-runtime-media.sh
HP_ITEMS='HOST-09 to HOST-17'
HP_APPLY_SUPPORTED=1
case "$0" in */*) HP_DIR=${0%/*} ;; *) HP_DIR=. ;; esac
# shellcheck source=host-profile-lib.sh
. "$HP_DIR/host-profile-lib.sh"
hp_init "$@"
hp_need ffmpeg-prefix

item HOST-09 MANUAL 'Node.js 26.8.2 (the version .node-version pins), installed under a root-owned path'
manual <<'EOF'
the official Linux binary archive of that version, unpacked as root; its checksum compared with the publisher's list by the user
EOF
check <<'EOF'
node --version                    -> v26.8.2
namei -l "$(command -v node)"     -> owner root on every component
EOF
confirm '9A/H-01 (installation method)'

item HOST-10 AUTO 'Build tools'
act apt-get install -y build-essential clang make pkg-config python3 nasm libasound2-dev
check <<'EOF'
dpkg -s clang make pkg-config python3 nasm libasound2-dev   -> "Status: install ok installed" 6 times
EOF
confirm '9A/H-01 (package names on 24.04)'

item HOST-11 MANUAL 'The FFmpeg development packages of the distribution are absent'
manual <<'EOF'
none if absent; if present: sudo apt-get remove libavformat-dev libavcodec-dev libavfilter-dev libswresample-dev libavutil-dev
EOF
check <<'EOF'
dpkg -s libavformat-dev   -> "is not installed"
EOF
confirm '9A/H-01 (hypothesis: Ubuntu 24.04 packages FFmpeg 6.1, which the worker refuses at build and at start)'

item HOST-12 MANUAL 'FFmpeg 9.0.2 (libavformat 63.1.102) built from the release source, with the ALSA input, as shared libraries'
manual <<'EOF'
in the unpacked release source, after the user has compared the checksum of the archive with the publisher's:
./configure --prefix=<ffmpeg-prefix> --enable-shared --disable-static --disable-doc --enable-indev=alsa
make -j"$(nproc)"
sudo make install
EOF
check <<'EOF'
<ffmpeg-prefix>/bin/ffmpeg -hide_banner -version   -> first line names 9.0.2; "libavformat 63.  1.102" below
<ffmpeg-prefix>/bin/ffmpeg -hide_banner -devices   -> a line that holds alsa with the demuxing mark D
EOF
confirm '9A/H-01 (the configure line; the feature set; the licence of the build is the open decision of the user; open point 2)'

item HOST-13 AUTO 'The dynamic loader finds the pinned libraries'
put_file /etc/ld.so.conf.d/dems-ffmpeg.conf 0644 root root <<'EOF'
<ffmpeg-prefix>/lib
EOF
act ldconfig
check <<'EOF'
ldconfig -p   -> lists libavformat.so.63 with a path under <ffmpeg-prefix>/lib
EOF
confirm '9A/H-01'

item HOST-14 MANUAL 'The capture worker built against the pinned library, with its own checks'
manual <<'EOF'
from <install-dir>, as root: PKG_CONFIG_PATH=<ffmpeg-prefix>/lib/pkgconfig make -C apps/capture-worker
EOF
check <<'EOF'
the command exits 0 (static rules, their self-test, unit checks, the import check of the binary)
ldd apps/capture-worker/build/capture-worker   -> resolves libavformat.so.63 under <ffmpeg-prefix>/lib
the start of the Core does not report CAPTURE_WORKER_MEDIA_LIBRARY_MISMATCH or CAPTURE_WORKER_PROGRAM_UNUSABLE
EOF
confirm '9A/H-01 (the build file names clang; the import list was fixed on macOS and may differ on glibc; open point 3)'

item HOST-15 MANUAL 'The camera relay and the guard program built against the same library'
manual <<'EOF'
their build commands are named by the product tree beside each program
EOF
check <<'EOF'
each program states the library version of HOST-12
the start of the Core names no version difference between the relay and the worker
EOF
confirm '9A/H-01'

item HOST-16 NONE 'The microphone helper is the pinned FFmpeg program, reached by an absolute root-owned path'
why <<'EOF'
nothing beyond HOST-12; the configuration of the Core names <ffmpeg-prefix>/bin/ffmpeg
EOF
check <<'EOF'
namei -l <ffmpeg-prefix>/bin/ffmpeg   -> owner root and no w for group or others on every component
EOF
confirm '9A/H-08 (the configuration key that names the program for the ALSA input)'

item HOST-17 NONE 'The process listing gives the full program path to the leftover check of the Core'
why <<'EOF'
procps is part of a default installation
EOF
check <<'EOF'
ps -axo pid=,comm=   -> short names (at most 15 characters); recorded
ps -axo pid=,args=   -> full paths; recorded
EOF
confirm '9A/H-24 (open point 6)'

hp_done
