#!/bin/sh
# Asset of plan row W58 (gateway_check/06_backend_gate.md) — item D: the socket heartbeat quoted in
# full, and one more watch of the session sweeper (item E). Started inside the P18 lock:
#   /usr/bin/lockf -k -t 900 .locks/core-server.lock sh <this file>
# Starts one process (the Core server, documented command), records its PID, stops it, releases.

set -u
ROOT=/Users/gsp-budi/Documents/DEMS
A=$(ls -d "$ROOT"/docs/*/gateway_check/assets | head -n 1)
LOG=$A/06_d3_server.log
cd "$ROOT" || exit 1
say() { echo "== $(date '+%H:%M:%S') $*"; }

say "1. snapshot before the start"
node "$A/06_db_snapshot.mjs" probe-before

say "2. start: DEMS_CORE_PORT=4420 npm run start -w @dems/core-server"
: > "$LOG"; chmod 600 "$LOG"
DEMS_CORE_PORT=4420 npm run start -w @dems/core-server >> "$LOG" 2>&1 &
NPM_PID=$!
echo "$NPM_PID" > .locks/core-server.pid
i=0
while [ "$i" -lt 60 ]; do
  PID=$(lsof -nP -iTCP:4420 -sTCP:LISTEN -t 2>/dev/null | head -n 1)
  [ -n "$PID" ] && break
  i=$((i + 1)); sleep 1
done
echo "    npm pid=$NPM_PID listener pid=$PID after ${i} s"

say "3. the socket probe (hello + the first heartbeat, validated against HeartbeatSchema)"
node --import tsx "$A/06_socket_probe.mjs"
PROBE=$?

say "4. watch the sweeper again for 20 s"
node "$A/06_sweeper_watch.mjs" 20
node "$A/06_db_snapshot.mjs" probe-after

say "5. stop what this row started"
kill -TERM "$PID" 2>/dev/null
j=0
while [ "$j" -lt 20 ] && lsof -nP -iTCP:4420 -sTCP:LISTEN > /dev/null 2>&1; do j=$((j + 1)); sleep 1; done
kill -0 "$NPM_PID" 2>/dev/null && kill -TERM "$NPM_PID" 2>/dev/null
echo "    listener gone after ${j} s; 4420 now:"
lsof -nP -iTCP:4420 -sTCP:LISTEN || echo "    none"
: > .locks/core-server.pid
say "6. done (probe exit=$PROBE)"
exit "$PROBE"
