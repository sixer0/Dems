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
  # Row 143b (S13-11 point 2, AD-02): THE SOURCE ADDRESS. Until that row the rule here was "the relay binds
  # nothing". It now gives its ONE socket, ONCE, in the one dial, the source address of the start message and NO
  # port, BEFORE the one connect; a failure ends the dial (no connect follows it); record mode cannot be started
  # without the address; the address is held to the relay's own strict reader; the relay's socket rule holds the
  # camera socket to it. A listener stays impossible: the two rules below and the import net (no listen, no accept).
  one S13-11 '[^a-z_]bin[d](' relay_rtsp.c "exactly one bind, in relay_rtsp.c: the source address of the camera socket"
  one S13-11 '        if (bin[d](c->fd, (struct sockaddr \*)&from, sizeof from)) return RELAY_CAMERA_UNREACHABLE;' relay_rtsp.c "the one bind is not the camera socket's, or its failure does not end the dial"
  one S13-11 'if (inet_pton(AF_INET, c->start->source, &from.sin_addr) != 1) return RELAY_INTERNAL;' relay_rtsp.c "the one bind is not addressed with the source address of the start message"
  one S13-11 '        from.sin_port = 0;' relay_rtsp.c "the one bind names a port of its own"
  one S13-11 '    if (c->start->source\[0\]) {' relay_rtsp.c "the source address of the start message is not given to the socket whenever it is stated"
  s11_b=$(grep -n '[^a-z_]bin[d](' "$dir/relay_rtsp.c" 2>/dev/null | head -1 | cut -d: -f1)
  s11_c=$(grep -n '[^a-z_]connec[t](' "$dir/relay_rtsp.c" 2>/dev/null | head -1 | cut -d: -f1)
  [ -n "$s11_b" ] && [ -n "$s11_c" ] && [ "$s11_b" -lt "$s11_c" ] || say "S13-11: the socket is not given its source address before it is connected"
  one S13-11 '    if (out->mode == RELAY_MODE_RECORD && !with_source) goto refused;' relay_core.c "record mode can be started without a source address"
  one S13-11 '    if (with_source && !source_ok(out->source)) goto refused;' relay_core.c "the source address is not held to the relay's strict reader"
  one S13-11 '    if (out->mode == RELAY_MODE_PREVIEW && !with_source) goto refused;' relay_core.c "preview mode can be started without a source address"
  one S13-11 '            if (((const struct sockaddr_in \*)&own)->sin_addr.s_addr != source.s_addr) return 1;' relay.c "the relay's socket rule does not hold the camera socket to the source address"
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

  # Row 153 (AD-05, RC-6): THE CONFINEMENT, its portable part. The one connect goes to the host and port of the
  # locator and nowhere else; every request is addressed with the locator or with an address that
  # relay_control_address held to the locator's host and port; the relay's own socket rule is asked when each leg
  # stands (probe, push, every re-open); the limits and - on Linux - "no new privileges" are set BEFORE the start
  # message is read and before a socket exists; no regular file can grow by the relay's hand.
  one RC-6 'if (inet_pton(AF_INET, c->start->host, &to.sin_addr) != 1) return RELAY_INTERNAL;' relay_rtsp.c "the one connect is not addressed with the host of the locator"
  one RC-6 'to.sin_port = htons((uint16_t)c->start->port);' relay_rtsp.c "the one connect is not addressed with the port of the locator"
  [ "$(grep -c 'exchange(c, "' "$dir/relay_rtsp.c" 2>/dev/null)" = "3" ] && [ "$(grep -c 'exchange(c, "DESCRIBE", c->start->locator, \|exchange(c, "SETUP", c->track, \|exchange(c, "PLAY", c->aggregate, ' "$dir/relay_rtsp.c" 2>/dev/null)" = "3" ] \
    && [ "$(grep -c '[^a-z_]request(c, "' "$dir/relay_rtsp.c" 2>/dev/null)" = "2" ] && [ "$(grep -c 'request(c, "[A-Z]*", c->aggregate, ' "$dir/relay_rtsp.c" 2>/dev/null)" = "2" ] || say "RC-6: a request is addressed with something else than the locator or an address held to its host (three exchanges, two plain requests)"
  [ "$(grep -c 'if ((r = relay_control_address(c->start, a.base, ' "$dir/relay_rtsp.c" 2>/dev/null)" = "2" ] || say "RC-6: the two request addresses of the description are not held to the locator's host and port"
  # Row 89: a fourth place, the preview (when its gate opens, before the parameter sets are written).
  [ "$(grep -c 'sockets_break_the_rule()' "$dir/relay.c" 2>/dev/null)" = "4" ] && [ "$(count 'if (!lost) return sockets_break_the_rule() ? RELAY_SOCKET_RULE : RELAY_STOPPED;')" = "1" ] || say "RC-6: the relay's own socket rule is not asked in its four places (the probe, the push, every re-open, the preview)"
  one RC-6 'if (setrlimit(RLIMIT_FSIZE, &none)) return -1;' relay.c "a regular file can grow by the relay's hand"
  rc6_h=$(grep -n 'if (hygiene()) { code = RELAY_HYGIENE_FAILED; goto done; }' "$dir/relay.c" 2>/dev/null | head -1 | cut -d: -f1)
  rc6_s=$(grep -n 'if ((code = read_start()))' "$dir/relay.c" 2>/dev/null | head -1 | cut -d: -f1)
  rc6_c=$(grep -n 'relay_camera_new(&g_start, ' "$dir/relay.c" 2>/dev/null | head -1 | cut -d: -f1)
  rc6_n=$(grep -n 'avformat_network_init();' "$dir/relay.c" 2>/dev/null | head -1 | cut -d: -f1)
  [ -n "$rc6_h" ] && [ -n "$rc6_s" ] && [ -n "$rc6_c" ] && [ -n "$rc6_n" ] && [ "$rc6_h" -lt "$rc6_n" ] && [ "$rc6_n" -lt "$rc6_s" ] && [ "$rc6_s" -lt "$rc6_c" ] && [ "$(count 'hygiene()')" = "1" ] || say "RC-6: the limits and the right to gain privileges are not given up before the start message is read and before the first socket"

  # S13-02 (a), (d): codes and counters only; one writer, to standard error; the library's messages are counted.
  none S13-02 '[^fnsv]printf(\|fprint[f](\|[^a-z_]put[s](\|putcha[r](\|perro[r](' "a print outside the one writer of relay.c"
  none S13-02 'av_err2st[r]\|strerro[r]\|av_strerro[r]' "a message text of the library or of the system"
  # Row 42 (AD-06 (3), S13-06): standard output carries ONE report line of fixed shape. ONE writer, in relay.c; it
  # has exactly two callers, each with a line that relay_core.c made from numbers and validated bytes; the probe
  # report has no member that could hold a text; both modes open the camera through the one call (Digest only).
  none S13-02 'stdou[t]' "the stream of standard output is used (the one writer writes the descriptor)"
  one S13-02 'write(STDOUT_FILEN[O]' relay.c "exactly one write to standard output, in relay.c (the report writer)"
  [ "$(count 'STDOUT_FILEN[O]')" = "4" ] && [ "$(files 'STDOUT_FILEN[O]')" = "relay.c" ] || say "S13-02: standard output is named outside the four lines of the report writer in relay.c"
  # Row 43 adds two callers (a loss, a re-open): four in all, each with a line of relay_core.c made from numbers.
  [ "$(count '[^a-z_]report(')" = "5" ] && [ "$(count ' = report(line, relay_established_line(g_start.attempt, line, sizeof line))')" = "1" ] && [ "$(count 'return report(line, relay_probe_line(&probe, line, sizeof line));')" = "1" ] \
    && [ "$(count ' = report(line, relay_loss_line(g_start.attempt, a->losses, lost, line, sizeof line))')" = "1" ] && [ "$(count ' = report(line, relay_reopened_line(g_start.attempt, again.losses, again.tries, ')" = "1" ] || say "AD-06: a report line is written that relay_core.c did not make (the writer has exactly four callers, each with a line of relay_core.c)"
  # Row 89 (relay.h "PREVIEW MODE"): in preview mode standard output carries the VIDEO, through the same one writer
  # (out_bytes: its callers are the report line and the video, nothing else). The video is written from its two places
  # only - the parameter sets when the gate opens (after the stream's facts were read and the socket rule asked) and a
  # picture the gate passed, in preview mode; its reader gone is the order to stop; preview mode states its source.
  [ "$(count '[^a-z_]out_bytes(')" = "3" ] && [ "$(count 'return out_bytes(line, (size_t)n, RELAY_REPORT_NOT_WRITTEN);')" = "1" ] || say "AD-06: the one writer of standard output has other callers than the report line and the video"
  [ "$(count '[^a-z_]media(')" = "3" ] && [ "$(count '    return media(extra, (size_t)n);')" = "1" ] && [ "$(count 'if (g_start.mode == RELAY_MODE_PREVIEW) { if ((code = media(picture.unit, picture.length))) break; }')" = "1" ] || say "PREVIEW: the video is written from somewhere else than its two places (the parameter sets when the gate opens, a picture the gate passed in preview mode)"
  one PREVIEW 'static RelayCode media(const uint8_t \*bytes, size_t n) { return out_bytes(bytes, n, RELAY_STOP_ASKED); }' relay.c "the reader of the video gone is not the order to stop"
  one PREVIEW '    RelayCode code = stream_facts(codec, sets, keyframe, extra, sizeof extra, &n, &width, &height);' relay.c "the parameter sets of a preview are not validated before the library's stream parser and before they are written"
  one AD-06 'int relay_established_line(long attempt, char \*out, size_t cap);' relay.h "the established line is made from anything but the attempt's number"
  one AD-06 'int relay_loss_line(long attempt, long loss, RelayCode cause, char \*out, size_t cap);' relay.h "the line of a loss is made from anything but numbers (never an address)"
  one AD-06 'int relay_reopened_line(long attempt, long loss, long tries, long held_back, long gap_ms, char \*out, size_t cap);' relay.h "the line of a re-open is made from anything but numbers (never an address)"
  # Row 43 (F10 a; design addendum 2.4, 5.1; experiment E-10): THE RE-OPEN. The push is announced once (BR-07 below)
  # and never again; after EVERY re-open the gate waits for the parameter sets and a keyframe of the new leg, and
  # the stream must be the announced one; a refused answer is counted and the second ends the relay; the tries of a
  # loss are bounded; a leg is given up without a request, and its challenge is not carried to the next connection.
  one RE-OPEN 'if (picture.keyframe && ((push.open && !again.pending) || relay_sets_complete(description.codec, sets))) {' relay.c "the gate after a re-open does not wait for the parameter sets and a keyframe of the new leg"
  one RE-OPEN 'if (!relay_same_stream(push.codec, &push.sets, description.codec, sets)) { code = RELAY_STREAM_INVALID; break; }' relay.c "a stream that came back as another one is forwarded into the announced push"
  one RE-OPEN 'if (kind == RELAY_LOSS_REFUSAL && ++a->refusals >= RELAY_AUTH_REFUSALS) return RELAY_AUTH_REFUSED;' relay.c "refused answers are not counted to the bound that ends the relay"
  one RE-OPEN 'if (!wait) return lost;' relay.c "the tries of a loss have no bound"
  one RE-OPEN 'if (step < 1) step = 1;' relay.c "the first picture of a new leg is not placed by this host's clock"
  [ "$(grep -c 'relay_camera_drop(camera);' "$dir/relay.c" 2>/dev/null)" = "3" ] || say "RE-OPEN: a camera leg that ended is not given up at once in its three places (the loss, a failed try, the end after a refusal)"
  one RE-OPEN '"TEARDOW[N]"' relay_rtsp.c "a request is sent on a leg that is being given up (TEARDOWN belongs to the end of the relay only)"
  one RE-OPEN '    c->have_challenge = 0;' relay_rtsp.c "the challenge of the old connection is carried to the new one"
  one RE-OPEN 'if (!c->have_key) { relay_wipe(&c->key, sizeof c->key); c->have_key = 1; }' relay_rtsp.c "a camera that challenges only on a re-open would be answered from an overwritten password"
  [ "$(sed -n '/^typedef struct RelayProbe {/,/^} RelayProbe;/p' "$dir/relay.h" 2>/dev/null | grep -c 'long attempt;')" = "1" ] && [ "$(sed -n '/^typedef struct RelayProbe {/,/^} RelayProbe;/p' "$dir/relay.h" 2>/dev/null | grep -c 'char')" = "0" ] || say "AD-06: the probe report has a member that can hold a text (it is numbers and validated parameter sets only)"
  one S13-01 'code = relay_camera_open(camera, &description);' relay.c "both modes must open the camera through the one call of the relay's own client"
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
  bad=$(nm -u "$1" 2>/dev/null | sed 's/^ *U *//; s/^_//; s/[$@].*//' | sort -u | grep -x 'open\|openat\|fopen\|freopen\|creat\|opendir\|mkstemp\|listen\|accept\|accept4\|sendto\|recvfrom\|sendmsg\|recvmsg\|socketpair\|getaddrinfo\|gethostbyname\|getenv\|secure_getenv\|system\|popen\|fork\|vfork\|execve\|execv\|execvp\|posix_spawn\|dlopen\|printf\|fprintf\|vfprintf\|puts\|fputs\|perror\|strerror\|avformat_open_input\|av_read_frame\|av_log\|av_log_set_level' | tr '\n' ' ')
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
                 'S13-11~relay_rtsp.c~static int planted(int s, const struct sockaddr *a) { return bind(s, a, 16); }' \
                 'RC-6~relay_rtsp.c~static int planted(void) { return socket(AF_INET, SOCK_DGRAM, 0); }' \
                 'RC-6~relay.c~static void planted(AVDictionary **o) { av_dict_set(o, "rtsp_transport", "udp", 0); }' \
                 'RC-6~relay_core.c~static int planted(const char *p) { return open(p, 0); }' \
                 'S13-02~relay.c~static void planted(const char *t) { fprintf(stderr, "%s", t); }' \
                 'S13-02~relay.c~static const char *planted(int e) { return av_err2str(e); }' \
                 'S13-02~relay.c~static void planted(void) { av_log_set_level(48); }' \
                 'S13-02~relay.c~static void planted(const char *t) { ssize_t w = write(STDOUT_FILENO, t, 1); (void)w; }' \
                 'AD-06~relay.c~static RelayCode planted(void) { return report(g_start.ingest, 10); }' \
                 'RE-OPEN~relay_rtsp.c~static void planted(RelayCamera *c) { request(c, "TEARDOWN", c->aggregate, NULL, NULL, NULL, 1); }' \
                 'RE-OPEN~relay.c~static void planted(RelayCamera *camera) { relay_camera_drop(camera); }' \
                 'RC-6~relay_rtsp.c~static RelayCode planted(RelayCamera *c, RelayAnswer *a) { return exchange(c, "DESCRIBE", a->base, NULL, a); }' \
                 'RC-6~relay.c~static int planted(void) { return sockets_break_the_rule(); }' \
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
                  'relay.h~s/    int width, height;/    int width, height; char codec_name[32];/~AD-06~a member of the probe report that can hold a text of the camera' \
                  'relay.c~s/code = relay_camera_open(camera, &description);/code = g_start.mode == RELAY_MODE_PROBE ? RELAY_STOPPED : relay_camera_open(camera, \&description);/~S13-01~probe mode with another way to the camera than the one client' \
                  'relay_rtsp.c~s/return now >= deadline ? late : RELAY_STOPPED;/return RELAY_STOPPED;/~H-2~a turn of a read loop no longer asks the bound' \
                  'relay_rtsp.c~s/        if ((r = turn(c, deadline, late))) return r;//~H-2~the read loops no longer ask the bound on every turn' \
                  'relay.c~s/    if (!relay_sets_valid(codec, sets)) return RELAY_STREAM_INVALID;//~M-1~the parameter sets reach the stream parser of the library unchecked' \
                  'relay.c~s/if (!relay_step_plausible(step, now - p->last_us, p->ticks + step, now - p->first_us)) return RELAY_STREAM_INVALID;//~M-3~the stamps of the camera are not held to the clock of this host' \
                  'relay.c~s/((push.open && !again.pending) || relay_sets_complete(description.codec, sets))/(push.open || relay_sets_complete(description.codec, sets))/~RE-OPEN~after a re-open any keyframe opens the gate, without the parameter sets of the new leg' \
                  'relay.c~s/if (!relay_same_stream(push.codec, &push.sets, description.codec, sets)) { code = RELAY_STREAM_INVALID; break; }//~RE-OPEN~a re-opened stream is not compared with the announced one' \
                  'relay.c~s/ && ++a->refusals >= RELAY_AUTH_REFUSALS) return RELAY_AUTH_REFUSED;/) a->refusals++;/~RE-OPEN~refused answers no longer end the relay' \
                  'relay.c~s/if (!wait) return lost;/if (!wait) a->tries = 0;/~RE-OPEN~the tries of a loss are without a bound' \
                  'relay.c~s/relay_loss_line(g_start.attempt, a->losses, lost, line, sizeof line)/snprintf(line, sizeof line, "%s", g_start.locator)/~AD-06~the line of a loss made from a text of the start message' \
                  'relay_rtsp.c~s/    c->have_challenge = 0;//~RE-OPEN~the challenge of the old connection answers on the new one before the camera asked' \
                  'relay_rtsp.c~s/inet_pton(AF_INET, c->start->host, /inet_pton(AF_INET, c->body, /~RC-6~the connect addressed with a text of the camera' \
                  'relay_rtsp.c~s/exchange(c, "SETUP", c->track, /exchange(c, "SETUP", a.base, /~RC-6~a request addressed with the Content-Base of the camera as it came' \
                  'relay.c~s/if (!lost) return sockets_break_the_rule() ? RELAY_SOCKET_RULE : RELAY_STOPPED;/if (!lost) return RELAY_STOPPED;/~RC-6~the socket rule is not asked after a re-open' \
                  'relay.c~s/    if (setrlimit(RLIMIT_FSIZE, &none)) return -1;//~RC-6~a regular file can grow by the hand of the relay' \
                  'relay_rtsp.c~s/        if (bind(c->fd, (struct sockaddr \*)&from, sizeof from)) return RELAY_CAMERA_UNREACHABLE;//~S13-11~the camera socket is connected without its source address' \
                  'relay_rtsp.c~s/if (bind(c->fd, (struct sockaddr \*)&from, sizeof from)) return RELAY_CAMERA_UNREACHABLE;/bind(c->fd, (struct sockaddr *)\&from, sizeof from);/~S13-11~a source address that cannot be given no longer ends the dial' \
                  'relay_rtsp.c~s/inet_pton(AF_INET, c->start->source, /inet_pton(AF_INET, c->start->host, /~S13-11~the socket given another address than the source address of the start message' \
                  'relay_rtsp.c~s/        from.sin_port = 0;/        from.sin_port = to.sin_port;/~S13-11~the camera socket bound to a port of its own' \
                  'relay_core.c~s/    if (out->mode == RELAY_MODE_RECORD && !with_source) goto refused;//~S13-11~a recording started without a source address' \
                  'relay_core.c~s/    if (with_source && !source_ok(out->source)) goto refused;//~S13-11~a source address that is not held to the strict reader' \
                  'relay.c~s/            if (((const struct sockaddr_in \*)&own)->sin_addr.s_addr != source.s_addr) return 1;//~S13-11~the socket rule no longer holds the camera socket to its source address' \
                  'relay.c~s/    if (hygiene()) { code = RELAY_HYGIENE_FAILED; goto done; }//;s/    avformat_network_init();/    avformat_network_init();\n    if (hygiene()) { code = RELAY_HYGIENE_FAILED; goto done; }/~RC-6~the limits are set after the library was prepared for the network'; do
    file=${mutation%%~*}; rest=${mutation#*~}; script=${rest%%~*}; rest=${rest#*~}; tag=${rest%%~*}; what=${rest#*~}
    n=$((n + 1)); dir="$work/mutated$n"; mkdir -p "$dir"; cp src/relay/*.c src/relay/*.h "$dir/"
    sed "$script" "src/relay/$file" > "$dir/$file"
    if cmp -s "src/relay/$file" "$dir/$file"; then echo "relay-check.sh selftest: the mutation '$what' changed nothing: the control is stale"; bad=1; continue; fi
    out=$(rules "$dir" 2>&1)
    if [ $? -eq 0 ]; then echo "relay-check.sh selftest: mutation ($what) was NOT refused: the rule cannot fail"; bad=1
    elif ! echo "$out" | grep -q ": $tag: "; then echo "relay-check.sh selftest: mutation ($what) was refused, but not by rule $tag: $out"; bad=1
    else echo "relay-check.sh selftest: refused as required ($tag): $what"; fi
  done
  # Review 060b S-07 (row T2): ONE CONTROL PER RULE, HELD TO THE RULE'S OWN MESSAGE. The two lists above are
  # matched by TAG: a control passes when ANY rule of its tag refuses, so a rule whose violation another rule of
  # the same tag also refuses - or that had no control at all - could be deleted from rules() and this selftest
  # stayed green. Every control below aims at ONE rule and must be refused with THAT rule's message (a fixed
  # text after the tag). Kind P appends one line to a copy, kind M changes a pinned line of a copy (and is stale
  # when it changes nothing). The proof that no rule line is left without a control is made from outside: each
  # statement of rules() deleted in turn from a scratch copy of this file must make --selftest fail (record
  # test/t2_test_strengthening.md of the task folder). A NEW RULE NEEDS ITS LINE HERE.
  for own in 'M~relay_rtsp.c~s/    if (c->start->source\[0\]) {/    if (c->start->source[0] \&\& c->start->mode == RELAY_MODE_RECORD) {/~S13-11~the source address of the start message is not given to the socket whenever it is stated~the source address given to the socket in record mode only' \
             'M~relay_rtsp.c~/^    if (c->start->source\[0\]) {$/,/^    }$/{H;d;};/^    if (connect(c->fd, /{G;}~S13-11~the socket is not given its source address before it is connected~the block that gives the source address moved BELOW the connect (every pinned line still there)' \
             'P~relay.c~static RelayCode planted(const char *t) { return out_bytes(t, 1, RELAY_STOPPED); }~AD-06~the one writer of standard output has other callers~a third caller of the one writer of standard output (row 89)' \
             'P~relay.c~static RelayCode planted(const uint8_t *b) { return media(b, 1); }~PREVIEW~the video is written from somewhere else~a third place that writes the video (row 89)' \
             'M~relay.c~s/{ return out_bytes(bytes, n, RELAY_STOP_ASKED); }/{ return out_bytes(bytes, n, RELAY_REPORT_NOT_WRITTEN); }/~PREVIEW~the reader of the video gone is not the order to stop~the end of the decoder made a failure of the relay (row 89)' \
             'M~relay.c~s/    RelayCode code = stream_facts(codec, sets, keyframe, extra, sizeof extra, &n, &width, &height);/    RelayCode code = RELAY_STOPPED;/~PREVIEW~the parameter sets of a preview are not validated~the parameter sets of a preview written without the stream facts read first (row 89)' \
             'M~relay_core.c~s/    if (out->mode == RELAY_MODE_PREVIEW && !with_source) goto refused;//~S13-11~preview mode can be started without a source address~a preview started without a source address (row 89)' \
             'P~relay_rtsp.c~static int planted(const char *h, struct addrinfo **r) { return getaddrinfo(h, NULL, NULL, r); }~RC-6~a name resolver~a name is looked up' \
             'P~relay_rtsp.c~static int planted(void) { int s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP); return s; }~RC-6~exactly one socket of the relay~a second stream socket' \
             'P~relay_rtsp.c~static int planted(int s, const struct sockaddr *a) { return connect(s, a, 16); }~RC-6~exactly one connect, in relay_rtsp.c~a second connect' \
             'M~relay_rtsp.c~s/to.sin_port = htons((uint16_t)c->start->port);/to.sin_port = htons(554);/~RC-6~the one connect is not addressed with the port of the locator~the connect addressed with a port that is not the one of the locator' \
             'M~relay_rtsp.c~s/    if ((r = relay_control_address(c->start, a.base, description->control, c->track, sizeof c->track))) return r;//~RC-6~the two request addresses of the description are not held to the locator~the address of SETUP no longer held to the host and port of the locator' \
             'P~relay.c~static void planted(void) { fflush(stdout); }~S13-02~the stream of standard output is used~the stream of standard output named' \
             'P~relay.c~static void planted(const char *t) { ssize_t w = write(STDERR_FILENO, t, 1); (void)w; }~S13-02~exactly one write to standard error~a second write to standard error' \
             'P~relay.c~static void planted(char *o, const char *f, va_list a) { vsnprintf(o, 64, f, a); }~S13-02~the log callback formats the library~a message of the library formatted' \
             'M~relay.c~s/prctl(PR_SET_DUMPABLE, 0, 0, 0, 0) || prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)/prctl(PR_SET_DUMPABLE, 0, 0, 0, 0)/~S13-02~not dumpable / no new privileges (Linux) is missing~new privileges can be gained on Linux' \
             'P~relay.c~static char planted(void) { return g_start.secret[0]; }~F10~the password is named outside its three places~the password read in a fourth place' \
             'M~relay.c~s/        relay_wipe(g_line, sizeof g_line);//~S13-02~the start message is not overwritten after it was read~the start message left in memory at the end of the relay' \
             'M~relay.c~s/avformat_alloc_output_context2(&p->out, NULL, "rtsp", g_start.ingest)/avformat_alloc_output_context2(\&p->out, NULL, "rtsp", g_start.locator)/~BR-07~the push is not addressed with the start message~the push addressed with another text than the ingest address' \
             'M~relay.c~s/if (avformat_version() != (unsigned)LIBAVFORMAT_VERSION_INT) { code = RELAY_LIBAVFORMAT_VERSION_MISMATCH; goto done; }//~F10~the start pin of libavformat is missing~the library that is loaded is not compared with the one of the build' \
             'M~relay_rtsp.c~s/RelayCode r = turn(c, deadline, late);/RelayCode r = RELAY_STOPPED;/~H-2~every read of the socket must ask the bound first~a read of the socket that does not ask the bound' \
             'M~relay.c~s/relay_camera_limit(camera, keyframe_deadline, RELAY_KEYFRAME_TIMEOUT);//~H-2~the bound of the first keyframe is not handed to the camera leg~the wait for the first keyframe without its bound' \
             'M~relay_rtsp.c~s/relay_camera_limit(c, mono_us() + RELAY_OPEN_BOUND_US, RELAY_CAMERA_STALLED);//~H-2~the open has no bound for DESCRIBE, SETUP and PLAY together~the open without its bound' \
             'P~relay_rtsp.c~static const char *planted = "Authorization: ";~S13-01~the Authorization header is written in exactly one place~a second place that writes the header' \
             'P~relay_core.c~static const char *planted = "Digest username=";~S13-01~the value of the Authorization header is made in exactly one place~a second place that makes the value of the header' \
             'M~relay_rtsp.c~s/return RELAY_AUTH_SCHEME_NOT_ALLOWED;/return RELAY_AUTH_REFUSED;/~S13-01~a challenge without Digest must end the open before the key is made~a challenge without Digest no longer ends the open with its own code' \
             'P~relay.c~static int planted(AVFormatContext *c, AVPacket *p) { return av_read_frame(c, p); }~F10~the library must not read the camera~the reader of the library' \
             'P~relay.c~static const char *planted = "rtsp_flags";~F10~no RTSP option of the library~an option of the RTSP reader of the library' \
             'P~relay_rtsp.c~static int planted(int s) { return accept(s, NULL, NULL); }~RC-6~the relay accepts nothing~a connection taken' \
             'M~relay.c~s/av_dict_set(&options, "rtsp_transport", "tcp", 0)/av_dict_set(\&options, "rtsp_transport", "udp", 0)/~RC-6~the push is not held to TCP~the one option of the push names another transport' \
             'P~relay.c~static void planted(const char *t) { ssize_t w = write(STDOUT_FILENO, t, 1); (void)w; }~S13-02~exactly one write to standard output~a second write to standard output' \
             'P~relay.c~static int planted(void) { return STDOUT_FILENO; }~S13-02~standard output is named outside the four lines~standard output named in a fifth line (no write)' \
             'M~relay.h~s/int relay_established_line(long attempt, char \*out, size_t cap);/int relay_established_line(long attempt, const char *text, char *out, size_t cap);/~AD-06~the established line is made from anything but the attempt~the established line made from a text as well' \
             'M~relay.h~s/int relay_loss_line(long attempt, long loss, RelayCode cause, char \*out, size_t cap);/int relay_loss_line(long attempt, long loss, const char *where, char *out, size_t cap);/~AD-06~the line of a loss is made from anything but numbers~the line of a loss made from a text' \
             'M~relay.h~s/int relay_reopened_line(long attempt, long loss, long tries, long held_back, long gap_ms, char \*out, size_t cap);/int relay_reopened_line(long attempt, const char *where, char *out, size_t cap);/~AD-06~the line of a re-open is made from anything but numbers~the line of a re-open made from a text' \
             'M~relay.c~s/if (step < 1) step = 1;//~RE-OPEN~the first picture of a new leg is not placed by this host~the first picture of a new leg placed by the stamp of the camera alone' \
             'M~relay_rtsp.c~s/if (!c->have_key) { relay_wipe(&c->key, sizeof c->key); c->have_key = 1; }//~RE-OPEN~a camera that challenges only on a re-open would be answered from an overwritten password~no empty key is set when the first leg needed none' \
             'M~relay_rtsp.c~/relay_wipe(c->start->secret, sizeof c->start->secret);/d~F10~the password is not overwritten where the key is made~the overwrite of the password where the key is made removed' \
             'M~relay_rtsp.c~/relay_wipe(c->start->secret, sizeof c->start->secret);/{h;s/.*/            ;/;G;}~F10~the overwrite of the password is not the line after the key~a line between the key and the overwrite of the password' \
             'M~relay.c~s/_Static_assert(LIBAVFORMAT_VERSION_INT == AV_VERSION_INT(/_Static_assert(LIBAVFORMAT_VERSION_INT >= AV_VERSION_INT(/~F10~the build pin of libavformat is missing~the build accepts any later libavformat'; do
    kind=${own%%~*}; rest=${own#*~}; file=${rest%%~*}; rest=${rest#*~}; text=${rest%%~*}; rest=${rest#*~}; tag=${rest%%~*}; rest=${rest#*~}; message=${rest%%~*}; what=${rest#*~}
    n=$((n + 1)); dir="$work/own$n"; mkdir -p "$dir"; cp src/relay/*.c src/relay/*.h "$dir/"
    if [ "$kind" = "P" ]; then printf '%s\n' "$text" >> "$dir/$file"; else sed "$text" "src/relay/$file" > "$dir/$file"; fi
    if cmp -s "src/relay/$file" "$dir/$file"; then echo "relay-check.sh selftest: the control '$what' changed nothing: the control is stale"; bad=1; continue; fi
    out=$(rules "$dir" 2>&1)
    if [ $? -eq 0 ]; then echo "relay-check.sh selftest: control ($what) was NOT refused: the rule cannot fail"; bad=1
    elif ! echo "$out" | grep -qF ": $tag: $message"; then echo "relay-check.sh selftest: control ($what) was refused, but not by its own rule ($tag: $message): $out"; bad=1
    else echo "relay-check.sh selftest: refused as required ($tag, by its own rule): $what"; fi
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
echo "relay-check.sh: $1: static rules OK (S13-01 Digest only: no Basic text, one header writer; F10 the library never reads the camera, password overwritten at the key, libavformat pin = the worker's; RC-6 no listener, no datagram, no resolver, one socket, one connect to the locator's host and port, every request held to them, the socket rule asked at every leg, limits before the first byte, push over TCP, no file opened, none can grow; S13-02 one writer of fixed words, library messages counted, core-file limit 0, no program started; AD-06 standard output: one writer, four report callers, each a line of relay_core.c, no text member in the probe report; PREVIEW (row 89) the video through the same writer from its two places, its reader gone the order to stop, the sets validated first, a source address stated; RE-OPEN one announce, the gate and the announced stream after every re-open, refusals counted, tries bounded, a leg given up without a request; BR-07 no argument, no environment, one announce to the address as it came; the worker's sources and the relay's are apart)"
