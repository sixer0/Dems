#!/bin/sh
# Static rules of the CAPTURE RELAY (task 4 blueprint row 41, WP-03a; security requirements S13-01, S13-02,
# RC-6, BR-07 (4); plan review F10 d). The relay is a separate program: these rules read src/relay/ and nothing
# of the worker; the worker's rules (check.sh) read src/*.c and src/*.h, a glob that does not reach src/relay/.
# The two programs have opposite socket rules (the worker listens on loopback and never dials out; the relay
# dials out and never listens), so neither file is put under the other's rules.
#
#   sh relay-check.sh <relay source dir>   the rules over one directory; exit 0 only if all hold
#   sh relay-check.sh --selftest           the rules over copies with ONE planted line each: every copy MUST be
#                                          refused, by its rule (negative controls), and an untouched copy passes
#   sh relay-check.sh --imports <binary>   THE IMPORT NET: what the linked relay imports names no function that
#                                          opens a file, listens, sends a datagram, resolves a name, reads the
#                                          environment, starts a process or prints (whatever the spelling was)
#
# Every forbidden text below is written with a bracket in it, so that this file does not contain it.
# Run from apps/capture-worker (the Makefile does). A tripwire, not a proof: the dynamic guards are the relay's
# own socket check (relay.c) and the runs of test-fixtures/row041_relay.py.
set -u

rules() {
  dir=$1
  fail=0
  say() { echo "relay-check.sh: $dir: $1"; fail=1; }
  count() { cat "$dir"/*.c "$dir"/*.h 2>/dev/null | grep -c -- "$1"; }
  files() { grep -l -- "$1" "$dir"/*.c "$dir"/*.h 2>/dev/null | sed 's|.*/||' | sort | tr '\n' ' ' | sed 's/ $//'; }
  none() { [ "$(count "$2")" = "0" ] || say "$1: $3"; }
  one() { [ "$(count "$2")" = "1" ] && [ "$(files "$2")" = "$3" ] || say "$1: $4"; }

  # S13-01: Digest only. No text of the other scheme is ever composed; ONE place writes the header, ONE makes its value.
  none S13-01 '"[^"]*Basi[c]' "a string that names the Basic scheme: the relay answers Digest only"
  none S13-01 'base64_encod[e]' "an encoder of the form the Basic scheme uses"
  one S13-01 '"Authorization: "' relay_rtsp.c "the Authorization header is written in exactly one place, in relay_rtsp.c"
  one S13-01 '"Digest username=' relay_core.c "the value of the Authorization header is made in exactly one place, in relay_core.c"
  one S13-01 'return RELAY_AUTH_SCHEME_NOT_ALLOWED;' relay_rtsp.c "a challenge without Digest must end the open before the key is made"
  # S13-01 / F10: the library's RTSP client is never given the camera (it answers Basic and takes the account in an address).
  none F10 'avformat_open_inpu[t]' "the library must not open the camera: the relay's own client does"
  none F10 'av_read_fram[e]' "the library must not read the camera"
  none F10 'rtsp_flag[s]' "no RTSP option of the library's reader"
  none F10 '%s:%s@' "an account composed into an address"

  # RC-6: no listener, no datagram socket, no resolver; ONE socket and ONE connect of the relay's own; the push is TCP.
  none RC-6 '[^a-z_]bin[d](' "the relay binds nothing"
  none RC-6 '[^a-z_]liste[n](' "the relay listens nowhere"
  none RC-6 '[^a-z_]accep[t](' "the relay accepts nothing"
  none RC-6 'SOCK_DGRA[M]\|sendt[o](\|recvfro[m](\|socketpai[r](' "a datagram socket or a pair"
  none RC-6 'getaddrinf[o]\|gethostbynam[e]' "a name resolver (a datagram socket and files)"
  one RC-6 '= socke[t](AF_INET, SOCK_STREAM, IPPROTO_TCP)' relay_rtsp.c "exactly one socket of the relay's own: a TCP stream socket in relay_rtsp.c"
  one RC-6 '[^a-z_]connec[t](' relay_rtsp.c "exactly one connect, in relay_rtsp.c"
  one RC-6 'av_dict_se[t]' relay.c "exactly one option is set on the push"
  one RC-6 'av_dict_set(&options, "rtsp_transport", "tcp", 0)' relay.c "the push is not held to TCP"
  # RC-6: no file is opened after start (none at all by the relay's own code).
  none RC-6 '[^a-z_]ope[n](\|fope[n](\|[^a-z_]crea[t](\|opendi[r](\|freope[n](\|mkstem[p]\|avio_ope[n]' "the relay opens a file"

  # S13-02 (a), (d): codes and counters only; one writer, to standard error; the library's messages are counted.
  none S13-02 '[^fnsv]printf(\|fprint[f](\|[^a-z_]put[s](\|putcha[r](\|perro[r](' "a print outside the one writer of relay.c"
  none S13-02 'av_err2st[r]\|strerro[r]\|av_strerro[r]' "a message text of the library or of the system"
  none S13-02 'STDOUT_FILEN[O]\|stdou[t]' "standard output is written (record mode writes nothing there)"
  one S13-02 'write(STDERR_FILEN[O]' relay.c "exactly one write to standard error, in relay.c"
  one S13-02 'av_log_set_callback(library_says)' relay.c "the library's log callback is not the relay's own"
  none S13-02 'av_log_set_leve[l]\|[^a-z_]av_lo[g](\|av_log_default_callbac[k]\|av_vlo[g]' "the library's own log output"
  [ "$(grep -c 'vsnprint[f]\|vfprint[f]\|va_ar[g]' "$dir/relay.c" 2>/dev/null)" = "0" ] || say "S13-02: the log callback formats the library's message"
  # BR-07 (4), S13-02: nothing of a session in an argument or the environment.
  none BR-07 'geten[v](\|[^a-z_]enviro[n][^m]\|argv\[' "the relay reads an argument or the environment"
  one BR-07 'if (argc != 1) { code = RELAY_USAGE; goto done; }' relay.c "an argument must be refused"
  # S13-02 (c): no core file; not dumpable and no new privileges on Linux; the message and the password are overwritten.
  one S13-02 'setrlimit(RLIMIT_CORE, &none)' relay.c "the core-file limit is not set to 0"
  one S13-02 'prctl(PR_SET_DUMPABLE, 0, 0, 0, 0) || prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)' relay.c "not dumpable / no new privileges (Linux) is missing"
  one F10 'relay_wipe(c->start->secret, sizeof c->start->secret);' relay_rtsp.c "the password is not overwritten where the key is made"
  [ "$(grep -A1 'relay_digest_key(a->digest.hash' "$dir/relay_rtsp.c" 2>/dev/null | grep -c 'relay_wipe(c->start->secret')" = "1" ] || say "F10: the overwrite of the password is not the line after the key"
  [ "$(count 'start->secret\|g_start.secret')" = "3" ] || say "F10: the password is named outside its three places (the key, its overwrite there, the overwrite after the open)"
  [ "$(grep -c 'relay_wipe(g_line, sizeof g_line);' "$dir/relay.c" 2>/dev/null)" = "2" ] || say "S13-02: the start message is not overwritten after it was read"
  # BR-07 (3): the announce is ONE call, to the address of the start message, unchanged.
  one BR-07 'avformat_write_heade[r](' relay.c "exactly one announce"
  one BR-07 'avformat_alloc_output_context2(&p->out, NULL, "rtsp", g_start.ingest)' relay.c "the push is not addressed with the start message's ingest address as it came"
  # F10 (d): the worker's library, at build and at start.
  one F10 '_Static_assert(LIBAVFORMAT_VERSION_INT == AV_VERSION_INT(' relay.c "the build pin of libavformat is missing"
  one F10 'if (avformat_version() != (unsigned)LIBAVFORMAT_VERSION_INT) { code = RELAY_LIBAVFORMAT_VERSION_MISMATCH; goto done; }' relay.c "the start pin of libavformat is missing"
  # S13-02: no other program is started; no part of the worker is compiled in.
  none S13-02 '[^a-z_]for[k](\|exec[lv][pe]*(\|[^a-z_]syste[m](\|pope[n](\|posix_spaw[n]\|dlope[n]' "the relay starts a program or loads code"
  none SEPARATE '#include "\.\./\|#include "worker\.h"\|#include "announce\.h"' "the relay includes a file of the worker"
  # Row 186, review H-2: the time bounds are absolute and asked on every turn of every loop that reads the camera;
  # the receive buffer is read by an index (ONE move, in the refill, never one per frame).
  one H-2 'return now >= deadline ? late : RELAY_STOPPED;' relay_rtsp.c "the one place that asks the bound on every turn is gone"
  [ "$(grep -c 'if ((r = turn(c, deadline, late))) return r;' "$dir/relay_rtsp.c" 2>/dev/null)" = "2" ] || say "H-2: the loop of the open and the loop of a playing camera must each ask the bound on every turn"
  one H-2 'RelayCode r = turn(c, deadline, late);' relay_rtsp.c "every read of the socket must ask the bound first"
  one H-2 'memmov[e](' relay_rtsp.c "the receive buffer is moved in exactly one place (the refill), never per frame"
  one H-2 'relay_camera_limit(camera, keyframe_deadline, RELAY_KEYFRAME_TIMEOUT);' relay.c "the bound of the first keyframe is not handed to the camera leg"
  one H-2 'relay_camera_limit(c, mono_us() + RELAY_OPEN_BOUND_US, RELAY_CAMERA_STALLED);' relay_rtsp.c "the open has no bound for DESCRIBE, SETUP and PLAY together"
  # Row 186, review M-1 / M-3: the library's parser sees valid parameter sets only; recorded time is held to this host's clock.
  one M-1 'if (!relay_sets_valid(codec, sets)) return RELAY_STREAM_INVALID;' relay.c "the parameter sets are not validated before the library's stream parser"
  one M-3 'if (!relay_step_plausible(step, now - p->last_us, p->ticks + step, now - p->first_us)) return RELAY_STREAM_INVALID;' relay.c "the camera's stamps are not held to this host's clock"
  # Row 186: the test hook (the camera leg on a descriptor a test made) exists behind ONE switch, in the camera leg only.
  [ "$(count 'RELAY_TEST_HOOK[S]')" = "3" ] && [ "$(files 'RELAY_TEST_HOOK[S]')" = "relay.h relay_rtsp.c" ] || say "HOOK: the test hook is named outside its three places (its declaration in relay.h; its body and the sanitizer's guard of the receive buffer in relay_rtsp.c)"
  [ "$(count 'relay_camera_adop[t]')" = "2" ] || say "HOOK: the test hook is used by the relay itself"
  return $fail
}

# The pin of the relay's build is the worker's pin (test/static/libavformat.pin): one version, two programs.
pin_rule() {
  want=$(grep -v '^#' test/static/libavformat.pin 2>/dev/null | awk -F'\t' '$1 == "libavformat" { print $2 }' | head -1)
  have=$(grep -o '_Static_assert(LIBAVFORMAT_VERSION_INT == AV_VERSION_INT([0-9, ]*)' "$1/relay.c" 2>/dev/null | sed 's/.*INT(//; s/)//; s/, */./g')
  [ -n "$want" ] && [ "$have" = "$want" ] || { echo "relay-check.sh: F10: the relay is pinned to libavformat ${have:-nothing}, the worker to ${want:-nothing}"; return 1; }
}

# The Makefile keeps the two programs apart: the worker's source list names nothing of src/relay/, the relay's
# list names nothing else, and the relay is not one of the worker's proof builds.
makefile_rule() {
  fail=0
  [ "$(grep -c '^SRC \|^HDR ' "$1")" = "2" ] && [ "$(grep '^SRC \|^HDR ' "$1" | grep -c 'relay')" = "0" ] || { echo "relay-check.sh: SEPARATE: $1: the worker's source list names a relay file"; fail=1; }
  [ "$(grep '^RELAY_SRC \|^RELAY_HDR ' "$1" | tr ' ' '\n' | grep -c '^src/')" = "$(grep '^RELAY_SRC \|^RELAY_HDR ' "$1" | tr ' ' '\n' | grep -c '^src/relay/')" ] || { echo "relay-check.sh: SEPARATE: $1: the relay's source list names a file outside src/relay/"; fail=1; }
  [ "$(grep -c -- '-o $(BUILD)/capture-worker-[a-z]*.*relay' "$1")" = "0" ] || { echo "relay-check.sh: SEPARATE: $1: a relay source in a build of the worker"; fail=1; }
  # Row 186: the relay is built with its hardening flags and WITHOUT the test hook.
  [ "$(grep -c '^RELAY_CFLAGS ' "$1")" = "1" ] && [ "$(grep '^RELAY_CFLAGS ' "$1" | grep -c 'RELAY_TEST_HOOK[S]\|-DRELAY_')" = "0" ] || { echo "relay-check.sh: HOOK: $1: the relay's flags name a test or proof switch"; fail=1; }
  [ "$(grep '^RELAY_CFLAGS ' "$1" | grep -c '$(RELAY_HARDEN) ')" = "1" ] && [ "$(grep -c '^RELAY_HARDEN := -U_FORTIFY_SOURCE -D_FORTIFY_SOURCE=2 -fstack-protector-strong -fPIE$' "$1")" = "1" ] || { echo "relay-check.sh: HARDEN: $1: the relay's flags lack the hardening (-D_FORTIFY_SOURCE=2 -fstack-protector-strong -fPIE)"; fail=1; }
  [ "$(grep -c '$(CC) $(RELAY_CFLAGS) -o $@ $(RELAY_SRC) $(RELAY_HARDEN_LD) $(RELAY_LDLIBS)$' "$1")" = "1" ] || { echo "relay-check.sh: HARDEN: $1: the relay is not linked from its own flags, sources and hardening"; fail=1; }
  return $fail
}

# Row 186 (review H-1, fix F-2): what the hardening flags leave in the BINARY, whatever the Makefile says.
hardening_rule() {
  syms=$(nm -u "$1" 2>/dev/null)
  echo "$syms" | grep -q 'stack_chk_fail' || { echo "relay-check.sh: imports: HARDEN: $1 has no stack protector (it does not import the stack check)"; return 1; }
  echo "$syms" | grep -q '\(mem\|str\|printf\)[a-z]*_chk' || { echo "relay-check.sh: imports: HARDEN: $1 was not built with _FORTIFY_SOURCE (it imports no checked copy function)"; return 1; }
  if command -v otool >/dev/null 2>&1 && otool -hv "$1" 2>/dev/null | grep -q 'MH_MAGIC'; then
    otool -hv "$1" | grep -q ' PIE' || { echo "relay-check.sh: imports: HARDEN: $1 is not position independent"; return 1; }
  elif command -v readelf >/dev/null 2>&1; then
    readelf -h "$1" 2>/dev/null | grep -q 'Type:.*DYN' || { echo "relay-check.sh: imports: HARDEN: $1 is not position independent"; return 1; }
  fi
  return 0
}

imports_rule() {
  [ -f "$1" ] || { echo "relay-check.sh: imports: no binary $1"; return 1; }
  bad=$(nm -u "$1" 2>/dev/null | sed 's/^ *U *//; s/^_//; s/[$@].*//' | sort -u | grep -x 'open\|openat\|fopen\|freopen\|creat\|opendir\|mkstemp\|bind\|listen\|accept\|accept4\|sendto\|recvfrom\|sendmsg\|recvmsg\|socketpair\|getaddrinfo\|gethostbyname\|getenv\|secure_getenv\|system\|popen\|fork\|vfork\|execve\|execv\|execvp\|posix_spawn\|dlopen\|printf\|fprintf\|vfprintf\|puts\|fputs\|perror\|strerror\|avformat_open_input\|av_read_frame\|av_log\|av_log_set_level' | tr '\n' ' ')
  [ -z "$bad" ] || { echo "relay-check.sh: imports: $1 imports $bad- the relay must not"; return 1; }
  nm -u "$1" 2>/dev/null | grep -q 'avformat_write_header' || { echo "relay-check.sh: imports: $1 is not the relay (it does not import the library's writer)"; return 1; }
  # Row 186: no sanitizer and no test hook in the binary the Core starts.
  [ "$(nm "$1" 2>/dev/null | grep -c 'relay_camera_adopt\|__asan_\|__ubsan_')" = "0" ] || { echo "relay-check.sh: imports: HOOK: $1 holds the test hook or a sanitizer: it is a test build, not the relay"; return 1; }
  hardening_rule "$1" || return 1
  return 0
}

if [ "${1:-}" = "--imports" ]; then
  imports_rule "${2:-}" || exit 1
  echo "relay-check.sh: ${2}: import net OK"
  exit 0
fi

if [ "${1:-}" = "--selftest" ]; then
  bad=0
  work=build/relay-selftest
  rm -rf "$work"; mkdir -p "$work/clean"
  cp src/relay/*.c src/relay/*.h "$work/clean/"
  rules "$work/clean" >/dev/null 2>&1 || { echo "relay-check.sh selftest: an untouched copy of src/relay/ is refused"; bad=1; }
  n=0
  for planted in 'S13-01~relay_rtsp.c~static const char *planted = "Authorization: Basic ";' \
                 'S13-01~relay_core.c~static int planted(char *o, const unsigned char *i) { return !av_base64_encode(o, 64, i, 8); }' \
                 'F10~relay.c~static int planted(AVFormatContext **c, const char *u) { return avformat_open_input(c, u, NULL, NULL); }' \
                 'F10~relay_rtsp.c~static int planted(char *o, const char *u, const char *s) { return snprintf(o, 64, "%s:%s@host/", u, s); }' \
                 'RC-6~relay_rtsp.c~static int planted(int s) { return listen(s, 1); }' \
                 'RC-6~relay_rtsp.c~static int planted(void) { return socket(AF_INET, SOCK_DGRAM, 0); }' \
                 'RC-6~relay.c~static void planted(AVDictionary **o) { av_dict_set(o, "rtsp_transport", "udp", 0); }' \
                 'RC-6~relay_core.c~static int planted(const char *p) { return open(p, 0); }' \
                 'S13-02~relay.c~static void planted(const char *t) { fprintf(stderr, "%s", t); }' \
                 'S13-02~relay.c~static const char *planted(int e) { return av_err2str(e); }' \
                 'S13-02~relay.c~static void planted(void) { av_log_set_level(48); }' \
                 'BR-07~relay.c~static const char *planted(void) { return getenv("RELAY_SECRET"); }' \
                 'BR-07~relay.c~static int planted(AVFormatContext *c) { return avformat_write_header(c, NULL); }' \
                 'S13-02~relay_rtsp.c~static int planted(void) { return fork(); }' \
                 'HOOK~relay.c~#ifdef RELAY_TEST_HOOKS' \
                 'HOOK~relay.c~static void planted(RelayCamera *c) { relay_camera_adopt(c, 0); }' \
                 'H-2~relay_rtsp.c~static void planted(RelayCamera *c) { memmove(c->buffer, c->buffer + 4, c->have - 4); }' \
                 'SEPARATE~relay.c~#include "../worker.h"'; do
    tag=${planted%%~*}; rest=${planted#*~}; file=${rest%%~*}; line=${rest#*~}
    n=$((n + 1)); dir="$work/planted$n"; mkdir -p "$dir"; cp src/relay/*.c src/relay/*.h "$dir/"
    printf '%s\n' "$line" >> "$dir/$file"
    out=$(rules "$dir" 2>&1)
    if [ $? -eq 0 ]; then echo "relay-check.sh selftest: planted line $n ($tag in $file) was NOT refused: the rule cannot fail"; bad=1
    elif ! echo "$out" | grep -q ": $tag: "; then echo "relay-check.sh selftest: planted line $n was refused, but not by rule $tag: $out"; bad=1
    else echo "relay-check.sh selftest: refused as required ($tag): $(echo "$out" | head -1 | sed "s|^relay-check.sh: $dir: ||")"; fi
  done
  # Evasions that CHANGE a pinned line: the overwrite of the password removed, the argument refusal removed, another pin.
  for mutation in 'relay_rtsp.c~/relay_wipe(c->start->secret, sizeof c->start->secret);/d~F10~the password is not overwritten after the key' \
                  'relay.c~s/if (argc != 1) { code = RELAY_USAGE; goto done; }//~BR-07~an argument is no longer refused' \
                  'relay.c~s/setrlimit(RLIMIT_CORE, &none)/0/~S13-02~the core-file limit is not set' \
                  'relay.c~s/av_log_set_callback(library_says);//~S13-02~the library logs by itself' \
                  'relay_rtsp.c~s/return now >= deadline ? late : RELAY_STOPPED;/return RELAY_STOPPED;/~H-2~a turn of a read loop no longer asks the bound' \
                  'relay_rtsp.c~s/        if ((r = turn(c, deadline, late))) return r;//~H-2~the read loops no longer ask the bound on every turn' \
                  'relay.c~s/    if (!relay_sets_valid(codec, sets)) return RELAY_STREAM_INVALID;//~M-1~the parameter sets reach the stream parser of the library unchecked' \
                  'relay.c~s/if (!relay_step_plausible(step, now - p->last_us, p->ticks + step, now - p->first_us)) return RELAY_STREAM_INVALID;//~M-3~the stamps of the camera are not held to the clock of this host'; do
    file=${mutation%%~*}; rest=${mutation#*~}; script=${rest%%~*}; rest=${rest#*~}; tag=${rest%%~*}; what=${rest#*~}
    n=$((n + 1)); dir="$work/mutated$n"; mkdir -p "$dir"; cp src/relay/*.c src/relay/*.h "$dir/"
    sed "$script" "src/relay/$file" > "$dir/$file"
    if cmp -s "src/relay/$file" "$dir/$file"; then echo "relay-check.sh selftest: the mutation '$what' changed nothing: the control is stale"; bad=1; continue; fi
    out=$(rules "$dir" 2>&1)
    if [ $? -eq 0 ]; then echo "relay-check.sh selftest: mutation ($what) was NOT refused: the rule cannot fail"; bad=1
    elif ! echo "$out" | grep -q ": $tag: "; then echo "relay-check.sh selftest: mutation ($what) was refused, but not by rule $tag: $out"; bad=1
    else echo "relay-check.sh selftest: refused as required ($tag): $what"; fi
  done
  # The pin: a relay pinned to another version than the worker's is refused.
  mkdir -p "$work/pin"; cp src/relay/*.c src/relay/*.h "$work/pin/"
  sed 's/AV_VERSION_INT(63, 1, 102)/AV_VERSION_INT(63, 1, 103)/' src/relay/relay.c > "$work/pin/relay.c"
  pin_rule "$work/pin" >/dev/null 2>&1 && { echo "relay-check.sh selftest: another libavformat pin was NOT refused"; bad=1; } || echo "relay-check.sh selftest: refused as required (F10): a relay pinned to another libavformat than the worker"
  # The import net on a real binary: a program that listens is refused by what it imports.
  if command -v "${CC:-clang}" >/dev/null 2>&1; then
    mkdir -p "$work/imports"
    printf '%s\n' '#include <sys/socket.h>' 'int avformat_write_header(void *a, void *b) { (void)a; (void)b; return 0; }' 'int main(void) { return listen(3, 1); }' > "$work/imports/listens.c"
    if "${CC:-clang}" -o "$work/imports/listens" "$work/imports/listens.c" 2>/dev/null; then
      imports_rule "$work/imports/listens" 2>&1 | grep -q 'imports listen' && echo "relay-check.sh selftest: refused as required (imports): a program that listens" || { echo "relay-check.sh selftest: a program that listens was NOT refused by the import net"; bad=1; }
    else echo "relay-check.sh selftest: the program of the import-net check did not compile"; bad=1; fi
    # Row 186: a program built without the hardening flags is refused by what its binary lacks.
    printf '%s\n' 'int main(void) { return 0; }' > "$work/imports/plain.c"
    if "${CC:-clang}" -o "$work/imports/plain" "$work/imports/plain.c" 2>/dev/null; then
      hardening_rule "$work/imports/plain" 2>&1 | grep -q 'HARDEN' && echo "relay-check.sh selftest: refused as required (HARDEN): a binary built without the hardening flags" || { echo "relay-check.sh selftest: a binary without the hardening flags was NOT refused"; bad=1; }
    else echo "relay-check.sh selftest: the program of the hardening check did not compile"; bad=1; fi
  else echo "relay-check.sh selftest: no C compiler for the import-net check"; bad=1; fi
  # Row 186: the Makefile. A relay built with the test hook, and one built without the hardening, are refused.
  mkdir -p "$work/makefile"
  for change in 's/^RELAY_CFLAGS := /RELAY_CFLAGS := -DRELAY_TEST_HOOKS /~HOOK~the relay built with the test hook' \
                's/ -fstack-protector-strong//~HARDEN~the relay built without the stack protector' \
                's/ $(RELAY_HARDEN_LD) $(RELAY_LDLIBS)$/ $(RELAY_LDLIBS)/~HARDEN~the relay linked without its hardening'; do
    script=${change%%~*}; rest=${change#*~}; tag=${rest%%~*}; what=${rest#*~}
    sed "$script" Makefile > "$work/makefile/Makefile"
    if cmp -s Makefile "$work/makefile/Makefile"; then echo "relay-check.sh selftest: the Makefile control '$what' changed nothing: the control is stale"; bad=1; continue; fi
    out=$(makefile_rule "$work/makefile/Makefile" 2>&1)
    if [ $? -eq 0 ]; then echo "relay-check.sh selftest: Makefile control ($what) was NOT refused: the rule cannot fail"; bad=1
    elif ! echo "$out" | grep -q ": $tag: "; then echo "relay-check.sh selftest: Makefile control ($what) was refused, but not by rule $tag: $out"; bad=1
    else echo "relay-check.sh selftest: refused as required ($tag): $what"; fi
  done
  rm -rf "$work"
  exit $bad
fi

[ $# -eq 1 ] || { echo "usage: sh relay-check.sh <relay source dir> | --selftest | --imports <binary>"; exit 2; }
rules "$1" || exit 1
pin_rule "$1" || exit 1
makefile_rule Makefile || exit 1
echo "relay-check.sh: $1: static rules OK (S13-01 Digest only: no Basic text, one header writer; F10 the library never reads the camera, password overwritten at the key, libavformat pin = the worker's; RC-6 no listener, no datagram, no resolver, one socket, one connect, push over TCP, no file opened; S13-02 one writer of fixed words, library messages counted, core-file limit 0, no program started; BR-07 no argument, no environment, one announce to the address as it came; the worker's sources and the relay's are apart)"
