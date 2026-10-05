#!/bin/sh
# W56 (blueprint step 78): the auth layer of LIVE mode on a device that is NOT paired.
# Lane 1: backend 127.0.0.1:4421, database dems_lane_1, the phone emulator (emulator-5554).
# Run from the repository root, inside the lane lock (sandbox bypass: port binding, adb, database):
#   /usr/bin/lockf -k -t 600 .locks/core-server.lane1.lock /bin/sh .cache/w56/run_w56.sh <mode>
# <mode> is passed to the device script: `look` or `attempt` (see device_w56.sh).
# Env: METRO_PORT (default 8082), LOCK_WAIT (device lock, default 300 s), TAP_* (see device_w56.sh).
#
# The method of W51 (`51_run_w51.sh`). It starts ONE process of its own, the lane backend (through
# the root script `start:server`), and stops it at the end. Metro and the reverse rules are
# device-session.sh's. Nothing on the ports 4420, 4422, 4423, 4400, 4432, 5173 to 5178 is used or
# stopped. The demo flag is off. The lane database is used as it is and is not reset: a device
# that is not paired can make no state-changing call, and this check shows that it makes none.
set -u
MODE=${1:-look}
ROOT=/Users/gsp-budi/Documents/DEMS
H="$ROOT/.cache/w56"
OUT="$H/out_$MODE"
PORT=4421
METRO=${METRO_PORT:-8082}
RUN="w56$MODE$(date +%H%M%S)"
mkdir -p "$OUT"
say() { printf '\n== %s %s\n' "$(date '+%H:%M:%S')" "$*"; }
listener() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -n 1; }

say "0. before: run id $RUN (mode $MODE); listeners on $PORT and on the Metro port $METRO"
if [ -n "$(listener $PORT)" ]; then
  lsof -nP -iTCP:$PORT -sTCP:LISTEN
  echo "port $PORT is busy; not starting"
  exit 70
fi
if [ -n "$(listener "$METRO")" ]; then
  lsof -nP -iTCP:"$METRO" -sTCP:LISTEN
  echo "Metro port $METRO is busy; not starting"
  exit 70
fi
echo "(no listener on $PORT, none on $METRO)"
uptime

start_server() {
  : >"$OUT/server.log"
  (cd "$ROOT" && DEMS_CORE_PORT=$PORT exec npm run start:server) >"$OUT/server.log" 2>&1 &
  NPM_PID=$!
  i=0
  until [ -n "$(listener $PORT)" ] || ! kill -0 "$NPM_PID" 2>/dev/null || [ "$i" -ge 120 ]; do
    i=$((i + 1))
    sleep 0.25
  done
  SERVER_PID=$(listener $PORT)
  [ -n "$SERVER_PID" ]
}

say "1. start the lane backend from the tree: DEMS_CORE_PORT=$PORT npm run start:server (demo flag off)"
TRY=1
until start_server; do
  echo "-- boot attempt $TRY failed; the log (codes and messages only):"
  tail -n 12 "$OUT/server.log" | cut -c1-240
  kill "$NPM_PID" 2>/dev/null
  if [ "$TRY" -ge 2 ]; then
    echo "the Core server did not boot in two attempts (a backend row may be mid-landing)"
    exit 70
  fi
  TRY=$((TRY + 1))
  echo "-- waiting 20 s, then attempt $TRY"
  sleep 20
done
echo "$SERVER_PID" >"$ROOT/.locks/core-server.lane1.pid"
echo "npm PID $NPM_PID, listener PID $SERVER_PID (recorded in .locks/core-server.lane1.pid), attempt $TRY"
lsof -nP -iTCP:$PORT -sTCP:LISTEN
grep -E 'configuration loaded' "$OUT/server.log" | grep -o '"port":[0-9]*,"database":"[a-z_0-9]*","demoControls":[a-z]*'

say "2. the server's health, from the host (curl)"
curl -s "http://127.0.0.1:$PORT/api/v1/health" | cut -c1-260
echo
HOST_LINES=$(grep -c . "$OUT/server.log")
echo "server log lines before the device session: $HOST_LINES"

say "3. device session: phone (emulator-5554), Metro $METRO, device tcp:4420 -> host tcp:$PORT"
METRO_PORT=$METRO DEMS_CORE_HOST_PORT=$PORT DEVICE_SESSION_MAX_SECONDS=420 LOCK_WAIT=${LOCK_WAIT:-300} \
  "$ROOT/apps/mobile/scripts/device-session.sh" phone "/bin/sh '$H/device_w56.sh' '$MODE' '$OUT'"
DEVICE_EXIT=$?
echo "device session exit=$DEVICE_EXIT"

say "4. the backend's request log during the device session (lines after line $HOST_LINES)"
tail -n +$((HOST_LINES + 1)) "$OUT/server.log" >"$OUT/server_device_part.log"
grep -c '"msg":"request completed"' "$OUT/server_device_part.log" | sed 's/^/request lines: /'
echo "-- by method, route, status and principal:"
grep '"msg":"request completed"' "$OUT/server_device_part.log" | sed -E 's/.*"method":"([^"]*)","route":"([^"]*)","status":([0-9]*).*"principal":([^,}]*).*/\1 \2 \3 principal=\4/' | sort | uniq -c
echo "-- requests to the sign-in operations (2: /auth/sign-in, 8: /auth/biometric/sign-in, 9: /auth/biometric/failure, 7: /auth/biometric); must be 0:"
grep '"msg":"request completed"' "$OUT/server_device_part.log" | grep -c -E '"route":"/api/v1/auth/(sign-in|biometric)'
echo "-- state-changing requests (POST) in all; must be 0:"
grep '"msg":"request completed"' "$OUT/server_device_part.log" | grep -c '"method":"POST"'
echo "-- socket lines:"
grep -i -E '"msg":"socket (opened|closed)"' "$OUT/server_device_part.log" | sed -E 's/"hostname":"[^"]*",//; s/"pid":[0-9]*,//; s/"time":[0-9]*,//' | cut -c1-200 | head -n 8
echo "-- a bearer value, a cookie or a credential in the server log of this run (count of lines; must be 0):"
grep -c -E 'dvc_|ses_|bio_|[Bb]earer |[Cc]ookie' "$OUT/server.log"

say "5. stop the backend and check that nothing is left"
kill "$SERVER_PID" 2>/dev/null
i=0
while [ -n "$(listener $PORT)" ] && [ "$i" -lt 40 ]; do
  i=$((i + 1))
  sleep 0.25
done
kill "$NPM_PID" 2>/dev/null
wait "$NPM_PID" 2>/dev/null
echo "npm exit status: $?"
# No rm outside the scratch folder in this row: the PID file is emptied, not removed (as W51 left it).
: >"$ROOT/.locks/core-server.lane1.pid"
tail -n 2 "$OUT/server.log" | sed -E 's/"hostname":"[^"]*",//' | cut -c1-160
lsof -nP -iTCP:$PORT -iTCP:"$METRO" -sTCP:LISTEN
echo "lsof exit $? (1 with no output: no listener on $PORT or $METRO)"
ps -p "$SERVER_PID" -o pid=,command= 2>/dev/null || echo "process $SERVER_PID is gone"
say "end of run $RUN"
exit "$DEVICE_EXIT"
