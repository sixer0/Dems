#!/bin/sh
# THE BUILD STAMP OF THE CAPTURE WORKER (audit 2026-11-05 row 87, C-P0-1b, defect DF-02; rulings D15(b), D25 N5,
# D29 Q7; names and format: docs/2026-11-05_team_update_audit/masterplan/01_specs_w1_register.md W6 + W8).
#
# Why. On 2026-11-05 a worker binary built before the 4+4 plan change was still installed and said the same version
# word as the new one; the Core could not tell them apart. The version word now moves with a release, and every
# release build of build/capture-worker gets a stamp file BESIDE it: <program>.stamp. The Core reads the stamp at
# boot (row 88) and refuses a program whose stamp is missing, names another version or protocol, or names another
# program file than the one in place. The stamp travels outside HELLO on purpose: the capture protocol stays 5 (D29 Q7).
#
#   sh stamp.sh <program> <source file>...   writes <program>.stamp (run by the Makefile after every link of
#                                            build/capture-worker; run from apps/capture-worker)
#   sh stamp.sh --selftest                   the format and the refusals of this script, on scratch files
#
# THE FORMAT (W8): ASCII, LF line ends, exactly four key=value lines in this order:
#   workerVersion=<WORKER_VERSION of src/worker.h>          e.g. capture-worker/0.7.0
#   protocolVersion=<CAPTURE_PROTOCOL_VERSION of src/worker.h> e.g. 5
#   sourceSha256=<64 lowercase hex>   the sha256 of the LISTING `sha256sum <source file>...` (one line
#                                     "<64 hex><two spaces><path>\n" per file, in the order given, paths as given,
#                                     relative to apps/capture-worker). The Makefile gives $(SRC) $(HDR) Makefile.
#   binarySha256=<64 lowercase hex>   the sha256 of the program file written
# Recompute the source hash by hand:  cd apps/capture-worker && sha256sum <the same files, same order> | sha256sum
set -eu

LC_ALL=C
export LC_ALL

sha_of() { # sha256 of the files named, in the form of sha256sum (shasum on macOS prints the same form)
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$@"; else shasum -a 256 "$@"; fi
}
hex_of_stdin() { sha_of - | cut -c1-64; }
is_hex64() { printf '%s' "$1" | grep -Eq '^[0-9a-f]{64}$'; }

# write_stamp <program> <header> <source file>...
write_stamp() {
  prog=$1; header=$2; shift 2
  [ -f "$prog" ] || { echo "stamp.sh: $prog: no program file to stamp"; return 1; }
  [ "$#" -ge 1 ] || { echo "stamp.sh: no source file named: the source hash would name nothing"; return 1; }
  for f in "$@"; do [ -f "$f" ] || { echo "stamp.sh: $f: a source file of the stamp is missing"; return 1; }; done
  case " $* " in *" $header "*) ;; *) echo "stamp.sh: $header is not in the source set of the stamp"; return 1 ;; esac
  # The two words come from the header that was compiled; each must be there exactly once and of its form.
  n=$(grep -c '^#define WORKER_VERSION ' "$header" || true)
  version=$(sed -n 's/^#define WORKER_VERSION "\(capture-worker\/[0-9]\{1,4\}\.[0-9]\{1,4\}\.[0-9]\{1,4\}\)"$/\1/p' "$header")
  [ "$n" = "1" ] && [ -n "$version" ] || { echo "stamp.sh: $header: no single WORKER_VERSION of the release form capture-worker/N.N.N"; return 1; }
  n=$(grep -c '^#define CAPTURE_PROTOCOL_VERSION ' "$header" || true)
  protocol=$(sed -n 's/^#define CAPTURE_PROTOCOL_VERSION \([1-9][0-9]\{0,3\}\)$/\1/p' "$header")
  [ "$n" = "1" ] && [ -n "$protocol" ] || { echo "stamp.sh: $header: no single CAPTURE_PROTOCOL_VERSION"; return 1; }
  # The program must hold the word the stamp names (a stale header beside a fresh binary, or the other way round).
  grep -aqF "$version" "$prog" || { echo "stamp.sh: $prog does not hold the word $version of $header"; return 1; }
  source_sha=$(sha_of "$@" | hex_of_stdin)
  binary_sha=$(sha_of "$prog" | cut -c1-64)
  is_hex64 "$source_sha" && is_hex64 "$binary_sha" || { echo "stamp.sh: no sha256 tool gave a hash"; return 1; }
  tmp="$prog.stamp.tmp.$$"
  printf 'workerVersion=%s\nprotocolVersion=%s\nsourceSha256=%s\nbinarySha256=%s\n' "$version" "$protocol" "$source_sha" "$binary_sha" > "$tmp"
  chmod 0644 "$tmp"
  mv -f "$tmp" "$prog.stamp"
  # Read back: four lines, the binary unchanged since it was hashed.
  [ "$(wc -l < "$prog.stamp" | tr -d ' ')" = "4" ] && [ "$(sed -n 4p "$prog.stamp")" = "binarySha256=$(sha_of "$prog" | cut -c1-64)" ] || { rm -f "$prog.stamp"; echo "stamp.sh: $prog.stamp did not read back as written"; return 1; }
  echo "stamp.sh: $prog.stamp: $version, protocol $protocol, source $source_sha, binary $binary_sha"
}

if [ "${1:-}" = "--selftest" ]; then
  work=$(mktemp -d "${TMPDIR:-/tmp}/stamp-selftest.XXXXXX")
  trap 'rm -rf "$work"' EXIT
  bad=0
  mkdir -p "$work/src"
  printf '#define CAPTURE_PROTOCOL_VERSION 5\n#define WORKER_VERSION "capture-worker/1.2.3"\n' > "$work/src/worker.h"
  printf 'int x;\n' > "$work/src/a.c"
  printf 'junk "capture-worker/1.2.3" junk\n' > "$work/prog"
  ( cd "$work" && write_stamp prog src/worker.h src/a.c src/worker.h >/dev/null ) || { echo "stamp.sh selftest: a good build was refused"; bad=1; }
  want_src=$( cd "$work" && sha_of src/a.c src/worker.h | hex_of_stdin )
  want_bin=$( sha_of "$work/prog" | cut -c1-64 )
  [ "$(cat "$work/prog.stamp" 2>/dev/null)" = "$(printf 'workerVersion=capture-worker/1.2.3\nprotocolVersion=5\nsourceSha256=%s\nbinarySha256=%s' "$want_src" "$want_bin")" ] \
    && echo "stamp.sh selftest: the stamp of a good build has the four lines of W8, in order" || { echo "stamp.sh selftest: the stamp does not have the W8 form"; bad=1; }
  [ "$(od -c "$work/prog.stamp" | grep -c '\\r')" = "0" ] || { echo "stamp.sh selftest: the stamp has a CR"; bad=1; }
  # Each control must be refused, and must leave no stamp of its own.
  refused() { # refused <what> <setup command>
    rm -f "$work/prog.stamp"
    ( cd "$work" && eval "$2" ) >/dev/null 2>&1 && { echo "stamp.sh selftest: NOT refused: $1"; bad=1; return; }
    [ -e "$work/prog.stamp" ] && { echo "stamp.sh selftest: refused but a stamp was left: $1"; bad=1; return; }
    echo "stamp.sh selftest: refused as required: $1"
  }
  refused 'a program that does not hold the version word' "printf 'other\n' > p2 && write_stamp p2 src/worker.h src/a.c src/worker.h && mv p2.stamp prog.stamp"
  refused 'no program file' "write_stamp nothing src/worker.h src/a.c src/worker.h && mv nothing.stamp prog.stamp"
  refused 'a missing source file' "write_stamp prog src/worker.h src/a.c src/gone.c src/worker.h"
  refused 'a header outside the source set' "write_stamp prog src/worker.h src/a.c"
  refused 'a proof word in the header' "sed 's/1.2.3/1.2.3-PROOF/' src/worker.h > src/h2.h && write_stamp prog src/h2.h src/a.c src/h2.h"
  refused 'two WORKER_VERSION lines' "cat src/worker.h src/worker.h > src/h3.h && write_stamp prog src/h3.h src/a.c src/h3.h"
  refused 'no protocol number' "grep -v PROTOCOL src/worker.h > src/h4.h && write_stamp prog src/h4.h src/a.c src/h4.h"
  [ "$bad" = "0" ] || exit 1
  exit 0
fi

[ "$#" -ge 2 ] || { echo "usage: sh stamp.sh <program> <source file>...  |  sh stamp.sh --selftest"; exit 2; }
prog=$1; shift
write_stamp "$prog" src/worker.h "$@"
