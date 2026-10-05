#!/bin/sh
# W51 (blueprint step 73): the first run of the mobile app against the REAL Core server.
# Lane 1: backend 127.0.0.1:4421, database dems_lane_1, the phone emulator (emulator-5554).
# Run from the repository root, inside the lane lock (sandbox bypass: port binding, adb, database):
#   /usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/w51/run_w51.sh
# Env: METRO_PORT (default 8082), LOCK_WAIT (device lock, default 900 s).
#
# It starts ONE process of its own, the lane backend (through the root script `start:server`), and
# stops it at the end. Metro and the reverse rules are device-session.sh's. Nothing on the ports
# 4420, 4422, 4423, 4400, 4432, 5173 to 5178 is used or stopped. The demo flag is off. The lane
# database is used as it is: this check makes no state-changing call (an unpaired tablet can make
# none), so it is not reset.
set -u
ROOT=/Users/gsp-budi/Documents/DEMS
H="$ROOT/.cache/w51"
OUT="$H/out"
PORT=4421
METRO=${METRO_PORT:-8082}
RUN="w51x$(date +%H%M%S)"
mkdir -p "$OUT"
say() { printf '\n== %s %s\n' "$(date '+%H:%M:%S')" "$*"; }
listener() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -n 1; }

say "0. before: run id $RUN; listeners on $PORT and on the Metro port $METRO"
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
  until [ -n "$(listener $PORT)" ] || ! kill -0 "$NPM_PID" 2>/dev/null || [ "$i" -ge 160 ]; do
    i=$((i + 1))
    sleep 0.25
  done
  SERVER_PID=$(listener $PORT)
  [ -n "$SERVER_PID" ]
}

say "1. start the lane backend from the tree: DEMS_CORE_PORT=$PORT npm run start:server (demo flag off)"
TRY=1
until start_server; do
  echo "-- boot attempt $TRY failed; the log:"
  tail -n 25 "$OUT/server.log"
  kill "$NPM_PID" 2>/dev/null
  if [ "$TRY" -ge 3 ]; then
    echo "the Core server did not boot in three attempts"
    cp "$OUT/server.log" "$OUT/server_boot_error.log"
    exit 70
  fi
  TRY=$((TRY + 1))
  echo "-- a backend row may be mid-landing: waiting 60 s, then attempt $TRY"
  sleep 60
done
echo "$SERVER_PID" >"$ROOT/.locks/core-server.lane1.pid"
echo "npm PID $NPM_PID, listener PID $SERVER_PID (recorded in .locks/core-server.lane1.pid), attempt $TRY"
lsof -nP -iTCP:$PORT -sTCP:LISTEN
grep -E '"msg":"(configuration loaded|listening|server listening|ready)' "$OUT/server.log" | cut -c1-260
grep -E 'configuration loaded' "$OUT/server.log" | grep -o '"port":[0-9]*,"database":"[a-z_0-9]*","demoControls":[a-z]*'

say "2. the server's health, from the host (curl)"
curl -s -D "$OUT/health_headers.txt" "http://127.0.0.1:$PORT/api/v1/health" | tee "$OUT/health_host.json"
echo
grep -i -E '^(HTTP|x-request-id|cache-control|set-cookie)' "$OUT/health_headers.txt" | tr -d '\r'
HOST_LINES=$(grep -c . "$OUT/server.log")
echo "server log lines before the device session: $HOST_LINES"
echo "$HOST_LINES" >"$OUT/host_lines.txt"

say "3. device session: phone (emulator-5554), Metro $METRO, device tcp:4420 -> host tcp:$PORT"
METRO_PORT=$METRO DEMS_CORE_HOST_PORT=$PORT DEVICE_SESSION_MAX_SECONDS=540 LOCK_WAIT=${LOCK_WAIT:-900} \
  "$ROOT/apps/mobile/scripts/device-session.sh" phone "/bin/sh '$H/device_w51.sh' '$RUN' '$OUT'"
DEVICE_EXIT=$?
echo "device session exit=$DEVICE_EXIT"
echo "$DEVICE_EXIT" >"$OUT/device_exit.txt"

say "4. the backend's request log during the device session (lines after line $HOST_LINES; reqId, method, route, status, principal)"
tail -n +$((HOST_LINES + 1)) "$OUT/server.log" >"$OUT/server_device_part.log"
grep -c '"msg":"request completed"' "$OUT/server_device_part.log" | sed 's/^/request lines: /'
grep '"msg":"request completed"' "$OUT/server_device_part.log" | sed -E 's/.*"reqId":"([^"]*)","method":"([^"]*)","route":"([^"]*)","status":([0-9]*).*"principal":([^,}]*).*/\1 \2 \3 \4 principal=\5/' | sort | uniq -c | sort -rn | awk '{ $1=""; print }' | cut -c1-140 | head -n 12
echo "-- by route and status:"
grep '"msg":"request completed"' "$OUT/server_device_part.log" | sed -E 's/.*"method":"([^"]*)","route":"([^"]*)","status":([0-9]*).*"principal":([^,}]*).*/\1 \2 \3 principal=\4/' | sort | uniq -c
echo "-- socket lines:"
grep -i -E 'socket|upgrade|/ws' "$OUT/server_device_part.log" | sed -E 's/"hostname":"[^"]*",//; s/"pid":[0-9]*,//' | cut -c1-240 | head -n 12
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
# No rm outside the temp folder in this row: the PID file is emptied, not removed.
: >"$ROOT/.locks/core-server.lane1.pid"
tail -n 4 "$OUT/server.log" | sed -E 's/"hostname":"[^"]*",//' | cut -c1-200
lsof -nP -iTCP:$PORT -iTCP:"$METRO" -sTCP:LISTEN
echo "lsof exit $? (1 with no output: no listener on $PORT or $METRO)"
ps -p "$SERVER_PID" -o pid=,command= 2>/dev/null || echo "process $SERVER_PID is gone"
say "end of run $RUN"
exit "$DEVICE_EXIT"
