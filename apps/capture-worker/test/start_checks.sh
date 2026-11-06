#!/bin/sh
# What a worker says when it is STARTED and given nothing (fix pass F-M3; reviews R63-06 and R63-07).
# `make -C apps/capture-worker unit` runs it:  sh test/start_checks.sh <build dir> "<cc and flags>" "<sources>" "<libs>"
#
#   R63-06  A PROOF BUILD IS ANY BUILD WITH ONE OF ITS SWITCHES. A worker compiled with ONE proof switch that
#           is NOT the mux seam (here: the no-truncation control, as a CFLAGS of the environment would add it)
#           says "-PROOF" in its HELLO. Until fix pass F-M3 the mark hung on DEMS_PROOF_MUX_EXTRA alone and
#           such a build said the release version (the red run of this check: `git stash` the sources, or read
#           worker.h of commit abf742f: the line of this script that greps "-PROOF" fails).
#           CONTROL: the same sources without a switch say the release word, exactly.
#   R63-07  THE libavformat PIN AT RUN TIME. A worker whose verified version is not the library it runs on
#           (a proof build names another number; a real mismatch needs another installed FFmpeg) refuses to
#           start: exit 70, ONE frame - CRASH LIBAVFORMAT_VERSION_MISMATCH, no session - and NO HELLO.
#           CONTROL: the release build on the pinned library says HELLO and exits 0.
# Every worker here is started with its standard input at end-of-file: it serves no session, opens no port.
set -u
build=$1; cc=$2; src=$3; libs=$4
fail=0
say() { echo "start_checks: FAILED: $1"; fail=1; }
frames() { "$1" --log "$1.jsonl" < /dev/null 2>/dev/null; }

$cc -o "$build/startcheck_release" $src $libs || { echo "start_checks: the release build of the check did not compile"; exit 1; }
$cc -DDEMS_PROOF_KEEP_TORN_TAIL -o "$build/startcheck_one_switch" $src $libs || { echo "start_checks: the one-switch build did not compile"; exit 1; }
$cc -DDEMS_PROOF_RUNTIME_LAVF_VERSION_INT='AV_VERSION_INT(63, 1, 103)' -o "$build/startcheck_lavf" $src $libs || { echo "start_checks: the run-time-pin build did not compile"; exit 1; }

out=$(frames "$build/startcheck_release"); rc=$?
[ "$rc" = "0" ] || say "control: the release build exits $rc with no session (expected 0)"
echo "$out" | head -1 | grep -Eq '"type":"HELLO","protocolVersion":[0-9]+,"workerVersion":"capture-worker/[0-9]+\.[0-9]+\.[0-9]+"\}$' || say "control: the first frame of the release build is not a HELLO with the release word: $(echo "$out" | head -1)"
echo "$out" | grep -q 'PROOF\|CRASH' && say "control: the release build says PROOF or CRASH"

out=$(frames "$build/startcheck_one_switch")
echo "$out" | head -1 | grep -Eq '"type":"HELLO".*"workerVersion":"capture-worker/[0-9]+\.[0-9]+\.[0-9]+-PROOF"\}$' || say "R63-06: a build with ONE proof switch (no mux seam) does not say -PROOF in its HELLO: $(echo "$out" | head -1)"

out=$(frames "$build/startcheck_lavf"); rc=$?
[ "$rc" = "70" ] || say "R63-07: on another libavformat the worker exits $rc (expected 70)"
[ "$(echo "$out" | grep -c .)" = "1" ] || say "R63-07: the refusal is not exactly one frame: $out"
echo "$out" | grep -Eq '^\{"v":[0-9]+,"type":"CRASH","sessionId":null,"code":"LIBAVFORMAT_VERSION_MISMATCH","signal":null,"exitCode":70\}$' || say "R63-07: the frame is not CRASH LIBAVFORMAT_VERSION_MISMATCH without a session: $out"
echo "$out" | grep -q 'HELLO\|HEARTBEAT' && say "R63-07: a worker that refuses to start says HELLO or HEARTBEAT"
grep -q '"message":"LIBAVFORMAT_VERSION_MISMATCH".*"running":"[0-9.]*","verified":"63.1.103"' "$build/startcheck_lavf.jsonl" 2>/dev/null || say "R63-07: the log does not name the two versions"

#   ROW 151  THE PROTOCOL-6 CAMERA ROW (D5 N-12, D30 K-3; R144-1 / D117). A camera row has SEVEN members - micChannel (its
#           own pair's channel, VIDEO-0N -> MIC-0N) and micMissing (null exactly when the plan holds that channel's row,
#           else NOT_ASSIGNED | NOT_OPENED). The release build is given ONE START line and the end of its input; it answers
#           with an ACK. Every refusal below differs from an ACCEPTED sibling by the one member it tests. A plan the reader
#           accepts is answered OUTPUT_DIR_MISSING, never PLAN_INVALID: its camera file sits in a folder that does not
#           exist, which is checked AFTER every shape rule and before anything is opened (no port, no file, no session).
#           REFUSED (PLAN_INVALID): a 5-member row (protocol 5), a 6-member row (no micMissing), a FOREIGN channel (another
#           pair's, or no channel word), a DUPLICATE channel (two cameras on MIC-01), a bad micMissing (an unknown word, a
#           number), a reason beside the row, a missing row without a reason, a mic row without its own file, a tap
#           without MIC-01.  CONTROLS (OUTPUT_DIR_MISSING): the 7-member row; a stated NOT_ASSIGNED / NOT_OPENED channel;
#           a channel of no camera left out; the same tapless plan without MIC-01.
v=$(frames "$build/startcheck_release" | head -1 | sed -n 's/.*"protocolVersion":\([0-9]*\).*/\1/p')
abs=$(cd "$build" && pwd)
nodir="$abs/startcheck_no_such_folder"
rm -rf "$nodir"
cam() {   # cam <n> <members after outputPath, e.g. ,"micChannel":"MIC-01","micMissing":null>
    printf '{"deviceId":"CAM-0%s","trackId":"VIDEO-0%s","profile":null,"ingestUrl":"rtsp://127.0.0.1:855%s/cam%s","outputPath":"%s/VIDEO-0%s.mp4"%s}' "$1" "$1" "$(($1 + 4))" "$1" "$nodir" "$1" "$2"
}
mic() {   # mic <n> [no-out]
    out=",\"outputPath\":\"$nodir/MIC-0$1.m4a\""
    [ "${2:-}" = "no-out" ] && out=""
    printf '{"deviceId":"MIC-0%s","channel":"MIC-0%s","input":{"kind":"PCM_FIFO","path":"%s/mic%s.pcm"}%s}' "$1" "$1" "$abs" "$1" "$out"
}
pair() { printf ',"micChannel":"MIC-0%s","micMissing":%s' "$1" "$2"; }
start_ack() {   # start_ack <label> <expected code> <cameras json> <mics json> [<activeMic> <pcmTapPath json>]
    line=$(printf '{"v":%s,"type":"START","sessionId":"S-ROW151","correlationId":"c151","attempt":1,"plan":{"cameras":[%s],"mics":[%s],"activeMic":"%s","pcmTapPath":%s,"constants":{"fragmentTargetMs":2000,"minFragDurationMs":2000,"gopFrames":50,"meterRateHz":20,"audioSampleRateHz":48000,"audioChannels":1}}}' \
           "$v" "$3" "$4" "${5:-MIC-01}" "${6:-null}")
    ack=$(echo "$line" | "$build/startcheck_release" --log "$build/startcheck_plan.jsonl" 2>/dev/null | grep '"type":"ACK"')
    if [ "$2" = "OK" ]; then want='"ok":true'; else want="\"ok\":false,\"code\":\"$2\""; fi
    echo "$ack" | grep -q "\"correlationId\":\"c151\",$want}" || say "row 151: $1: expected $2, the worker answered: ${ack:-nothing}"
}
[ -n "$v" ] || say "row 151: the release build's HELLO names no protocol version"
tap="\"$abs/startcheck_tap.s16\""
start_ack "control: the 7-member row"                  OUTPUT_DIR_MISSING "$(cam 1 "$(pair 1 null)")" "$(mic 1)"
start_ack "a 5-member row (protocol 5)"                PLAN_INVALID       "$(cam 1 "")" "$(mic 1)"
start_ack "a 6-member row (no micMissing)"             PLAN_INVALID       "$(cam 1 ',"micChannel":"MIC-01"')" "$(mic 1)"
start_ack "a 6-member row (no micChannel)"             PLAN_INVALID       "$(cam 1 ',"micMissing":null')" "$(mic 1)"
start_ack "a foreign channel (another pair's)"         PLAN_INVALID       "$(cam 1 "$(pair 2 null)")" "$(mic 1),$(mic 2)"
start_ack "a foreign channel (MIC-05)"                 PLAN_INVALID       "$(cam 1 "$(pair 5 '"NOT_ASSIGNED"')")" "$(mic 1)"
start_ack "a foreign channel (a role word)"            PLAN_INVALID       "$(cam 1 ',"micChannel":"PRIMARY","micMissing":null')" "$(mic 1)"
start_ack "a foreign channel (null)"                   PLAN_INVALID       "$(cam 1 ',"micChannel":null,"micMissing":null')" "$(mic 1)"
start_ack "a duplicate channel (two cameras, MIC-01)"  PLAN_INVALID       "$(cam 1 "$(pair 1 null)"),$(cam 2 "$(pair 1 null)")" "$(mic 1),$(mic 2)"
start_ack "control: two cameras, each its own pair"    OUTPUT_DIR_MISSING "$(cam 1 "$(pair 1 null)"),$(cam 2 "$(pair 2 null)")" "$(mic 1),$(mic 2)"
start_ack "a bad micMissing (unknown word)"            PLAN_INVALID       "$(cam 1 "$(pair 1 null)"),$(cam 2 "$(pair 2 '"LOST"')")" "$(mic 1)"
start_ack "a bad micMissing (a number)"                PLAN_INVALID       "$(cam 1 "$(pair 1 null)"),$(cam 2 "$(pair 2 1)")" "$(mic 1)"
start_ack "a bad micMissing (lower case)"              PLAN_INVALID       "$(cam 1 "$(pair 1 null)"),$(cam 2 "$(pair 2 '"not_opened"')")" "$(mic 1)"
start_ack "control: a stated NOT_OPENED channel"       OUTPUT_DIR_MISSING "$(cam 1 "$(pair 1 null)"),$(cam 2 "$(pair 2 '"NOT_OPENED"')")" "$(mic 1)"
start_ack "control: a stated NOT_ASSIGNED channel"     OUTPUT_DIR_MISSING "$(cam 1 "$(pair 1 null)"),$(cam 2 "$(pair 2 '"NOT_ASSIGNED"')")" "$(mic 1)"
start_ack "a reason beside the channel's row"          PLAN_INVALID       "$(cam 1 "$(pair 1 null)"),$(cam 2 "$(pair 2 '"NOT_OPENED"')")" "$(mic 1),$(mic 2)"
start_ack "a missing channel row without a reason"     PLAN_INVALID       "$(cam 1 "$(pair 1 null)"),$(cam 2 "$(pair 2 null)")" "$(mic 1)"
start_ack "control: a channel of no camera left out"   OUTPUT_DIR_MISSING "$(cam 1 "$(pair 1 null)")" "$(mic 1),$(mic 3)"
start_ack "a mic row without its own file"             PLAN_INVALID       "$(cam 1 "$(pair 1 null)")" "$(mic 1 no-out)"
start_ack "a tap without MIC-01"                       PLAN_INVALID       "$(cam 1 "$(pair 1 '"NOT_OPENED"')"),$(cam 2 "$(pair 2 null)")" "$(mic 2)" MIC-02 "$tap"
start_ack "control: the same plan without the tap"     OUTPUT_DIR_MISSING "$(cam 1 "$(pair 1 '"NOT_OPENED"')"),$(cam 2 "$(pair 2 null)")" "$(mic 2)" MIC-02 null
#   ROW 152  R151-1 LIFTED (D131): a plan WITHOUT the MIC-01 row (activeMic MIC-01, as the Core's plan.ts sends it when
#           MIC-01 did not open) is a plan - no tap, its camera stating the channel missing. The legacy word MIC-02 still
#           needs its own row. The zero-line plan (every camera stating its channel missing) is a plan too.
start_ack "row 152 control: no MIC-01 row, activeMic MIC-01" OUTPUT_DIR_MISSING "$(cam 1 "$(pair 1 '"NOT_OPENED"')"),$(cam 2 "$(pair 2 null)")" "$(mic 2)" MIC-01 null
start_ack "row 152 control: no microphone line at all"      OUTPUT_DIR_MISSING "$(cam 1 "$(pair 1 '"NOT_OPENED"')"),$(cam 2 "$(pair 2 '"NOT_ASSIGNED"')")" "" MIC-01 null
start_ack "row 152: activeMic MIC-02 without its row"       PLAN_INVALID       "$(cam 1 "$(pair 1 null)"),$(cam 2 "$(pair 2 '"NOT_OPENED"')")" "$(mic 1)" MIC-02 null
start_ack "row 152: no MIC-01 row, with a tap"              PLAN_INVALID       "$(cam 1 "$(pair 1 '"NOT_OPENED"')"),$(cam 2 "$(pair 2 null)")" "$(mic 2)" MIC-01 "$tap"
[ -e "$nodir" ] && say "row 151: a refused or folder-less plan created $nodir"

rm -f "$build"/startcheck_*.jsonl
[ "$fail" = "0" ] && echo "start_checks: all checks hold (R63-06: one proof switch marks HELLO, control: release word; R63-07: another libavformat at run time -> CRASH LIBAVFORMAT_VERSION_MISMATCH instead of HELLO, exit 70, control: HELLO and exit 0; row 151: the protocol-6 camera row - 15 refusals PLAN_INVALID (5- and 6-member rows, foreign and duplicate channel, bad micMissing, reason/row mismatch, mic row without file, tap without MIC-01), 6 controls reach OUTPUT_DIR_MISSING; row 152: a plan without the MIC-01 row and a plan without any microphone line reach OUTPUT_DIR_MISSING, MIC-02 without its row and a tap without MIC-01 stay PLAN_INVALID)"
exit $fail
