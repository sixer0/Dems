#!/bin/sh
# Asset of plan row W58 (gateway_check/06_backend_gate.md) — items D, E and the log probes of G.
#
# The smoke run of the main instance: this row is the sole owner of 127.0.0.1:4420 and of
# `dems_demo` while it runs (P18). It is meant to be started INSIDE the lock:
#   /usr/bin/lockf -k -t 900 .locks/core-server.lock sh <this file>
# from /Users/gsp-budi/Documents/DEMS. It starts one process (the Core server, by the documented
# command of 02_plan §5.3), records its PID in .locks/core-server.pid, and stops it again.
# PostgreSQL (PID 19121) is never touched (P15). No other agent's process is stopped (P7).

set -u
ROOT=/Users/gsp-budi/Documents/DEMS
A=$ROOT/docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/assets
SERVER_LOG=$A/06_d_server.log
cd "$ROOT" || exit 1

say() { echo "== $(date '+%H:%M:%S') $*"; }

say "0. inside the lock: $(ls -la .locks/core-server.lock 2>/dev/null | awk '{print $NF, $5}')"
say "0b. listener on 4420 before the start (expect none)"
lsof -nP -iTCP:4420 -sTCP:LISTEN || echo "    no listener on 4420"

say "1. snapshot of dems_demo before the start (sweeper baseline, item E)"
node "$A/06_db_snapshot.mjs" before-start

say "2. start the server from the current tree: DEMS_CORE_PORT=4420 npm run start -w @dems/core-server"
: > "$SERVER_LOG"
chmod 600 "$SERVER_LOG"
DEMS_CORE_PORT=4420 npm run start -w @dems/core-server >> "$SERVER_LOG" 2>&1 &
NPM_PID=$!
echo "$NPM_PID" > .locks/core-server.pid
echo "    npm pid=$NPM_PID, recorded in .locks/core-server.pid"

say "3. wait for health (up to 90 s)"
LISTENER_PID=''
i=0
while [ "$i" -lt 90 ]; do
  LISTENER_PID=$(lsof -nP -iTCP:4420 -sTCP:LISTEN -t 2>/dev/null | head -n 1)
  if [ -n "$LISTENER_PID" ] && curl -sf http://127.0.0.1:4420/api/v1/health > /dev/null 2>&1; then break; fi
  i=$((i + 1))
  sleep 1
done
if [ -z "$LISTENER_PID" ]; then
  echo "    START FAILED: no listener after ${i} s; tail of the server log:"
  tail -n 20 "$SERVER_LOG"
  exit 1
fi
echo "    listener pid=$LISTENER_PID after ${i} s"
curl -s -o /dev/null -w "    health http_status=%{http_code}\n" http://127.0.0.1:4420/api/v1/health
curl -s http://127.0.0.1:4420/api/v1/health

say "4. watch the session sweeper of the listening server for 25 s (item E), then snapshot again"
node "$A/06_sweeper_watch.mjs" 25
node "$A/06_db_snapshot.mjs" after-25s-of-listening

say "5. the smoke steps (health, sign-in, protected call, denied call + audit row, socket heartbeat, log probes)"
node --import tsx "$A/06_smoke.mjs"
SMOKE_EXIT=$?
echo "    smoke exit=$SMOKE_EXIT"

say "6. lsof proof: one listener on 127.0.0.1, and the sockets of that pid"
lsof -nP -iTCP:4420 -sTCP:LISTEN
echo "    all sockets of pid $LISTENER_PID:"
lsof -nP -a -p "$LISTENER_PID" -i

say "7. stop what this row started (the listener first, gracefully, then the npm wrapper)"
kill -TERM "$LISTENER_PID" 2>/dev/null
j=0
while [ "$j" -lt 30 ]; do
  if ! lsof -nP -iTCP:4420 -sTCP:LISTEN > /dev/null 2>&1; then break; fi
  j=$((j + 1))
  sleep 1
done
echo "    listener gone after ${j} s"
if kill -0 "$NPM_PID" 2>/dev/null; then kill -TERM "$NPM_PID" 2>/dev/null; sleep 2; fi
kill -0 "$NPM_PID" 2>/dev/null && kill -KILL "$NPM_PID" 2>/dev/null
echo "    npm pid $NPM_PID alive: $(kill -0 "$NPM_PID" 2>/dev/null && echo yes || echo no)"
echo "    listener on 4420 after the stop:"
lsof -nP -iTCP:4420 -sTCP:LISTEN || echo "    none"

say "8. snapshot after the stop, and the tail of the server log (graceful shutdown lines)"
node "$A/06_db_snapshot.mjs" after-stop
tail -n 12 "$SERVER_LOG"

: > .locks/core-server.pid
say "9. done; the lock is released when this script returns"

exit "$SMOKE_EXIT"
