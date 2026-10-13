#!/bin/bash
# Runs INSIDE the container of Dockerfile.ubuntu-24.04 (task 4 blueprint row 78). Never on a host.
#
# Builds the capture worker, the camera relay and the capture guard from the product tree at
# /opt/dems/core by the worker's own build file, against the FFmpeg of $DEMS_FFMPEG_PREFIX, exactly as
# item HOST-14 of the host profile words it, and prints what a reader needs to judge the result:
#   part 1  what this container is (distribution, architecture, compiler, tools)
#   part 2  the took-effect checks of HOST-11 to HOST-13
#   part 3  `make versions`
#   part 4  THE VERDICT: `make -C apps/capture-worker`, its exit code
#   part 5  every step of that build ONE BY ONE, each with its own exit code, so that a build that stops at
#           its first failure does not hide the ones behind it
#   part 6  the three programs: present, what they are, what they link, how they are hardened
# It changes nothing outside apps/capture-worker/build of the tree it runs in and reaches no network.
# Exit code: that of part 4.
set -u

TREE=${DEMS_TREE:-/opt/dems/core}
PREFIX=${DEMS_FFMPEG_PREFIX:-/opt/dems/ffmpeg-9.0.2}
W=apps/capture-worker
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig"

if [ ! -f /.dockerenv ] || [ "$(uname -s)" != Linux ]; then
  echo "build-in-container.sh: this script runs inside the container only (see README.md beside it)" >&2
  exit 64
fi
cd "$TREE" || exit 66

say() { printf '\n==== %s\n' "$*"; }
step() { # step <label> <command...>: run, print the exit code on a line of its own
  local label=$1; shift
  printf '\n---- %s\n$ %s\n' "$label" "$*"
  "$@"; local rc=$?
  printf 'STEP-RESULT\t%s\trc=%d\n' "$label" "$rc"
  return 0
}

say "PART 1  the container"
. /etc/os-release; echo "distribution: $PRETTY_NAME"
echo "architecture: $(uname -m)   kernel (of the virtual machine, not Ubuntu 24.04's own host kernel): $(uname -r)"
echo "user: $(id -un) (uid $(id -u))"
clang --version | head -n 1
make --version | head -n 1
echo "pkg-config $(pkg-config --version)"
python3 --version
echo "glibc: $(ldd --version | head -n 1)"
echo "sanitizer runtime of clang (needed by 'make relay-asan' and 'make relay-fuzz'):"
dpkg -l 'libclang-rt-*' 2>/dev/null | awk '/^ii/ {print "  installed: " $2 " " $3} END {if (!NR) print "  none listed"}'
echo "packages the distribution offers (index read at image build, nothing of them installed):"
sed 's/^/  /' /opt/dems/container/apt-candidates.txt 2>/dev/null | grep -E '^  [a-z]|Candidate'

say "PART 2  HOST-11, HOST-12, HOST-13"
if dpkg -s libavformat-dev >/dev/null 2>&1; then echo "HOST-11: FAIL libavformat-dev of the distribution is installed"; else echo "HOST-11: libavformat-dev is not installed"; fi
"$PREFIX/bin/ffmpeg" -hide_banner -version | head -n 1
"$PREFIX/bin/ffmpeg" -hide_banner -version | grep -E 'libav(format|codec|filter|util)|libswresample'
"$PREFIX/bin/ffmpeg" -hide_banner -version | grep '^configuration:'
echo "HOST-12 devices: $("$PREFIX/bin/ffmpeg" -hide_banner -devices 2>/dev/null | grep ' alsa ')"
echo "HOST-13: $(ldconfig -p | grep 'libavformat.so.63 ')"
echo "FFmpeg source (pinned SHA-256, release key signature):"; sed 's/^/  /' /opt/dems/container/ffmpeg-source.sha256 2>/dev/null | grep -E 'tar.xz|ffmpeg-devel|VALIDSIG|GOODSIG'

say "PART 3  make versions"
step versions make -C "$W" versions

say "PART 4  THE VERDICT: PKG_CONFIG_PATH=$PKG_CONFIG_PATH make -C $W"
make -C "$W" clean >/dev/null 2>&1
make -C "$W"; VERDICT=$?
printf 'VERDICT\tmake -C %s\trc=%d\n' "$W" "$VERDICT"

say "PART 5  every step of 'all' by itself (all: check selftest unit build/capture-worker relay guard)"
step check              make -C "$W" check
step selftest           make -C "$W" selftest
step unit               make -C "$W" unit
step worker-binary      make -C "$W" build/capture-worker
step relay-check        make -C "$W" relay-check
step relay-unit         make -C "$W" relay-unit
step relay-asan         make -C "$W" relay-asan
step relay-fuzz         make -C "$W" relay-fuzz
step relay-binary       make -C "$W" build/capture-relay
step guard-binary       make -C "$W" build/capture-guard build/guard_double
step guard              make -C "$W" guard

say "PART 6  the three programs"
for b in capture-worker capture-relay capture-guard; do
  p="$W/build/$b"
  printf '\n-- %s\n' "$b"
  if [ ! -x "$p" ]; then echo "PROGRAM\t$b\tABSENT" | sed 's/\\t/\t/g'; continue; fi
  printf 'PROGRAM\t%s\tpresent\t%s bytes\tsha256 %s\n' "$b" "$(stat -c %s "$p")" "$(sha256sum "$p" | cut -d' ' -f1)"
  file -b "$p"
  echo "links (ldd, FFmpeg libraries only):"; ldd "$p" | grep -E 'libav|libsw' | sed 's/^[[:space:]]*/  /' || true
  [ "$(ldd "$p" | grep -cE 'libav|libsw')" = 0 ] && echo "  no FFmpeg library (expected of the guard only)"
  echo "names itself: $(strings -a "$p" | grep -m1 -E '^capture-(worker|relay|guard)/[0-9]' || echo 'no "<program>/<version>" string in the binary')"
  echo "hardening: type $(readelf -h "$p" | awk '/Type:/ {print $2}'); $(readelf -lW "$p" | grep -c GNU_RELRO) GNU_RELRO segment(s); BIND_NOW $(readelf -dW "$p" | grep -cE 'BIND_NOW|FLAGS.*NOW'); stack check import $(nm -u "$p" | grep -c '__stack_chk_fail'); fortified copies $(nm -u "$p" | grep -c '_chk@')"
done
echo
echo "No program of the three has a version switch: the worker states its name and the library in its first"
echo "log lines of a session, the relay refuses to run on another libavformat (exit LIBAVFORMAT_VERSION_MISMATCH),"
echo "the guard links no library. The versions above are therefore read from the build and from the binaries."

printf '\nVERDICT\tmake -C %s\trc=%d\n' "$W" "$VERDICT"
exit "$VERDICT"
