#!/bin/sh
# W57 (blueprint step 79), third session (the second one repeated on the finished production code): the layout of the Pair screen on the TABLET in both
# orientations, Simulated and LIVE (paired). Nothing is paired or unpaired here.
# Lane 2: backend 127.0.0.1:4422, database dems_lane_2, the tablet emulator (emulator-5556).
# Run from the repository root, inside the lane lock (sandbox bypass: port binding, adb, database):
#   /usr/bin/lockf -k -t 900 .locks/core-server.lane2.lock /bin/sh .cache/w57/run_w57c.sh
# Env: METRO_PORT (default 8083), LOCK_WAIT (device lock, default 900 s).
#
# It starts ONE process of its own, the lane backend (through the root script `start:server`), and
# stops it at the end. Metro and the reverse rules are device-session.sh's. Nothing on the ports
# 4420, 4421, 4423, 4400, 4432, 5173 to 5178 is used or stopped (5177 is named in an Origin header
# only). The demo flag is off. The lane database is NOT reset, before or after: this check pairs
# the tablet with it, and a device credential belongs to one database.
set -u
ROOT=/Users/gsp-budi/Documents/DEMS
H="$ROOT/.cache/w57"
OUT="$H/out3"
PORT=4422
METRO=${METRO_PORT:-8083}
RUN="w57c$(date +%H%M%S)"
mkdir -p "$OUT"
say() { printf '\n== %s %s\n' "$(date '+%H:%M:%S')" "$*"; }
listener() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -n 1; }
counts() {
  (cd "$ROOT" && npm run db:status -w @dems/core-server -- --database dems_lane_2 2>&1) | grep -E "^ +(paired_devices|device_credentials|pairing_codes|biometric_tokens|sessions|audit_log) +[0-9]+|db:status:" | sed 's/^ */   /'
}

say "0. before: run id $RUN; listeners on $PORT and on the Metro port $METRO; dems_lane_2 as it is (not reset)"
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
counts | tee "$OUT/db_counts_before.txt"

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
  tail -n 25 "$OUT/server.log" | cut -c1-300
  kill "$NPM_PID" 2>/dev/null
  if [ "$TRY" -ge 2 ]; then
    echo "the Core server did not boot in two attempts"
    cp "$OUT/server.log" "$OUT/server_boot_error.log"
    exit 70
  fi
  TRY=$((TRY + 1))
  echo "-- a backend row may be mid-landing: waiting 120 s, then attempt $TRY"
  sleep 120
done
echo "$SERVER_PID" >"$ROOT/.locks/core-server.lane2.pid"
echo "npm PID $NPM_PID, listener PID $SERVER_PID (recorded in .locks/core-server.lane2.pid), attempt $TRY"
lsof -nP -iTCP:$PORT -sTCP:LISTEN
grep -E 'configuration loaded' "$OUT/server.log" | grep -o '"port":[0-9]*,"database":"[a-z_0-9]*","demoControls":[a-z]*'

say "2. the server's health, from the host (curl)"
curl -s -D "$OUT/health_headers.txt" "http://127.0.0.1:$PORT/api/v1/health" | tee "$OUT/health_host.json"
echo
grep -i -E '^(HTTP|cache-control|set-cookie)' "$OUT/health_headers.txt" | tr -d '\r'
HOST_LINES=$(grep -c . "$OUT/server.log")
echo "server log lines before the device session: $HOST_LINES"

say "3. device session: tablet (emulator-5556), Metro $METRO, device tcp:4420 -> host tcp:$PORT"
METRO_PORT=$METRO DEMS_CORE_HOST_PORT=$PORT DEVICE_SESSION_MAX_SECONDS=840 LOCK_WAIT=${LOCK_WAIT:-900} \
  "$ROOT/apps/mobile/scripts/device-session.sh" tablet "/bin/sh '$H/device_w57b.sh' '$RUN' '$OUT' '$OUT/server.log' '$PORT'"
DEVICE_EXIT=$?
echo "device session exit=$DEVICE_EXIT"
echo "$DEVICE_EXIT" >"$OUT/device_exit.txt"

say "4. the backend's request log during the device session (lines after line $HOST_LINES)"
tail -n +$((HOST_LINES + 1)) "$OUT/server.log" >"$OUT/server_device_part.log"
echo "-- by route, status and principal kind:"
grep '"msg":"request completed"' "$OUT/server_device_part.log" | sed -E 's/.*"method":"([^"]*)","route":"([^"]*)","status":([0-9]*).*"principal":([^,}]*).*/\1 \2 \3 principal=\4/' | sed -E 's/principal="?(operator|device|null)[^ ]*/principal=\1/' | sort | uniq -c
echo "-- the pairing requests, with their request IDs (to be found in the device log too):"
grep '"msg":"request completed"' "$OUT/server_device_part.log" | grep -E '"route":"/api/v1/pairing/(redeem|code)"' | sed -E 's/.*"reqId":"([^"]*)","method":"([^"]*)","route":"([^"]*)","status":([0-9]*).*/   \1 \2 \3 \4/'
echo "-- socket lines:"
grep -E '"msg":"socket (opened|closed)"' "$OUT/server_device_part.log" | sed -E 's/"hostname":"[^"]*",//; s/"pid":[0-9]*,//; s/"time":[0-9]*,//' | cut -c1-220 | head -n 14
echo "-- lines with a bearer value, a cookie or a credential in the server log of this run (must be 0):"
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
# No rm outside the scratch folder in this row: the PID file is emptied, not removed.
: >"$ROOT/.locks/core-server.lane2.pid"
tail -n 3 "$OUT/server.log" | sed -E 's/"hostname":"[^"]*",//' | cut -c1-200
lsof -nP -iTCP:$PORT -iTCP:"$METRO" -sTCP:LISTEN
echo "lsof exit $? (1 with no output: no listener on $PORT or $METRO)"
ps -p "$SERVER_PID" -o pid=,command= 2>/dev/null || echo "process $SERVER_PID is gone"

say "6. dems_lane_2 after the check (the backend is stopped; the database is left as it is: the tablet is paired with it)"
counts | tee "$OUT/db_counts_after.txt"
say "end of run $RUN"
exit "$DEVICE_EXIT"
