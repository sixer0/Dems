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

rm -f "$build"/startcheck_*.jsonl
[ "$fail" = "0" ] && echo "start_checks: all checks hold (R63-06: one proof switch marks HELLO, control: release word; R63-07: another libavformat at run time -> CRASH LIBAVFORMAT_VERSION_MISMATCH instead of HELLO, exit 70, control: HELLO and exit 0)"
exit $fail
