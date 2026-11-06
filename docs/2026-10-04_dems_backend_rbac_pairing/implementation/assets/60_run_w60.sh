#!/bin/sh
# W60 (blueprint step 82): the mobile pairing gate on the PHONE against the REAL Core server.
# Lane 1: backend 127.0.0.1:4421, database dems_lane_1, the phone emulator (emulator-5554).
# Run from the repository root, INSIDE the lane lock (sandbox bypass: port binding, adb, database):
#   /usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/w60/run_w60.sh
# Env: METRO_PORT (default 8083), LOCK_WAIT (device lock, default 900 s).
#
# It starts ONE process of its own, the lane backend (through `start:server`), and stops it at the end.
# Metro and the reverse rules are device-session.sh's. The standard lane reset runs once at the start
# (db:reset keeps paired_devices/device_credentials per [DB:§8.5 R-5]). Nothing on ports 4420, 4422,
# 4423, 4400, 4432, 5173-5178 is used or stopped. The demo flag is off. dems_lane_2 is never touched.
set -u
ROOT=/Users/gsp-budi/Documents/DEMS
H="$ROOT/.cache/w60"
OUT="$H/out"
PORT=4421
METRO=${METRO_PORT:-8083}
RUN="w60x$(date +%H%M%S)"
mkdir -p "$OUT"
say() { printf '\n== %s %s\n' "$(date '+%H:%M:%S')" "$*"; }
listener() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -n 1; }
counts() {
  (cd "$ROOT" && npm run db:status -w @dems/core-server -- --database dems_lane_1 2>&1) | grep -E "^ +(paired_devices|device_credentials|pairing_codes|biometric_tokens|sessions|audit_log) +[0-9]+|db:status:" | sed 's/^ */   /'
}

say "0. before: run id $RUN; listeners on $PORT and Metro $METRO must be free"
if [ -n "$(listener $PORT)" ]; then lsof -nP -iTCP:$PORT -sTCP:LISTEN; echo "port $PORT busy"; exit 70; fi
if [ -n "$(listener "$METRO")" ]; then lsof -nP -iTCP:"$METRO" -sTCP:LISTEN; echo "Metro $METRO busy"; exit 70; fi
echo "(no listener on $PORT, none on $METRO)"; uptime
counts | tee "$OUT/db_counts_before_reset.txt"

say "1. standard lane reset of dems_lane_1 (keeps the pairing tables per R-5)"
(cd "$ROOT" && npm run db:reset -w @dems/core-server -- --database dems_lane_1 2>&1) | tail -n 6 | sed 's/^/   /'
counts | tee "$OUT/db_counts_after_reset.txt"

start_server() {
  : >"$OUT/server.log"
  (cd "$ROOT" && DEMS_CORE_PORT=$PORT exec npm run start:server) >"$OUT/server.log" 2>&1 &
  NPM_PID=$!
  i=0
  until [ -n "$(listener $PORT)" ] || ! kill -0 "$NPM_PID" 2>/dev/null || [ "$i" -ge 160 ]; do i=$((i + 1)); sleep 0.25; done
  SERVER_PID=$(listener $PORT); [ -n "$SERVER_PID" ]
}
say "2. start the lane backend: DEMS_CORE_PORT=$PORT npm run start:server (demo flag off)"
TRY=1
until start_server; do
  echo "-- boot attempt $TRY failed:"; tail -n 25 "$OUT/server.log" | cut -c1-300
  kill "$NPM_PID" 2>/dev/null
  if [ "$TRY" -ge 2 ]; then echo "the Core server did not boot in two attempts"; cp "$OUT/server.log" "$OUT/server_boot_error.log"; exit 70; fi
  TRY=$((TRY + 1)); echo "-- waiting 120 s then attempt $TRY"; sleep 120
done
echo "$SERVER_PID" >"$ROOT/.locks/core-server.lane1.pid"
echo "npm PID $NPM_PID, listener PID $SERVER_PID (recorded in .locks/core-server.lane1.pid), attempt $TRY"
lsof -nP -iTCP:$PORT -sTCP:LISTEN
grep -E 'configuration loaded' "$OUT/server.log" | grep -o '"port":[0-9]*,"database":"[a-z_0-9]*","demoControls":[a-z]*' | sed 's/^/   /'

say "3. health from the host (curl)"
curl -s "http://127.0.0.1:$PORT/api/v1/health" | tee "$OUT/health_host.json"; echo
HOST_LINES=$(grep -c . "$OUT/server.log")
echo "server log lines before the device session: $HOST_LINES"

say "4. device session: phone (emulator-5554), Metro $METRO, device tcp:4420 -> host tcp:$PORT"
METRO_PORT=$METRO DEMS_CORE_HOST_PORT=$PORT DEVICE_SESSION_MAX_SECONDS=720 LOCK_WAIT=${LOCK_WAIT:-900} \
  "$ROOT/apps/mobile/scripts/device-session.sh" phone "/bin/sh '$H/device_w60.sh' '$RUN' '$OUT' '$OUT/server.log' '$PORT'"
DEVICE_EXIT=$?
echo "device session exit=$DEVICE_EXIT"; echo "$DEVICE_EXIT" >"$OUT/device_exit.txt"

say "5. the backend's request log during the device session (by route/status/principal)"
tail -n +$((HOST_LINES + 1)) "$OUT/server.log" >"$OUT/server_device_part.log"
grep '"msg":"request completed"' "$OUT/server_device_part.log" | sed -E 's/.*"method":"([^"]*)","route":"([^"]*)","status":([0-9]*).*"principal":([^,}]*).*/\1 \2 \3 principal=\4/' | sed -E 's/principal="?(operator|device|null)[^ ]*/principal=\1/' | sort | uniq -c | sed 's/^/   /'
echo "-- socket lines:"
grep -E '"msg":"socket (opened|closed)"' "$OUT/server_device_part.log" | sed -E 's/"hostname":"[^"]*",//; s/"pid":[0-9]*,//; s/"time":[0-9]*,//' | cut -c1-200 | head -n 12 | sed 's/^/   /'
echo "-- bearer/cookie/credential lines in the server log this run (must be 0): $(grep -c -E 'dvc_|ses_|bio_|[Bb]earer |[Cc]ookie' "$OUT/server.log")"

say "6. stop the backend and check nothing is left"
kill "$SERVER_PID" 2>/dev/null
i=0; while [ -n "$(listener $PORT)" ] && [ "$i" -lt 40 ]; do i=$((i + 1)); sleep 0.25; done
kill "$NPM_PID" 2>/dev/null; wait "$NPM_PID" 2>/dev/null
: >"$ROOT/.locks/core-server.lane1.pid"
tail -n 3 "$OUT/server.log" | sed -E 's/"hostname":"[^"]*",//' | cut -c1-160 | sed 's/^/   /'
lsof -nP -iTCP:$PORT -iTCP:"$METRO" -sTCP:LISTEN; echo "lsof exit $? (1 = no listener on $PORT or $METRO)"
ps -p "$SERVER_PID" -o pid=,command= 2>/dev/null || echo "process $SERVER_PID is gone"

say "7. dems_lane_1 after the check (backend stopped; the phone is now paired with it)"
counts | tee "$OUT/db_counts_after.txt"
say "end of run $RUN"
exit "$DEVICE_EXIT"
