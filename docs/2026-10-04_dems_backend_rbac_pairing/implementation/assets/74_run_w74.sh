#!/bin/sh
# W74 device check, lane 1 (phone, dems_lane_1 on 127.0.0.1:4421). NO lane reset: the phone is paired
# as DEV-0001 (D137) and that must survive. Run INSIDE the lane lock:
#   /usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/w74/run_w74.sh
set -u
ROOT=/Users/gsp-budi/Documents/DEMS; H="$ROOT/.cache/w74"; OUT="$H/out"; PORT=4421; METRO=${METRO_PORT:-8083}
mkdir -p "$OUT"
say() { printf '\n== %s %s\n' "$(date '+%H:%M:%S')" "$*"; }
listener() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -n 1; }
counts() { npm --prefix "$ROOT" run db:status -w @dems/core-server -- --database dems_lane_1 2>&1 | grep -E "^ +(paired_devices|device_credentials|sessions|audit_log|evidence) +[0-9]+|db:status:" | sed 's/^ */   /'; }

say "0. before (no reset): ports free?; dems_lane_1 counts"
[ -z "$(listener $PORT)" ] || { echo "port $PORT busy"; exit 70; }
[ -z "$(listener "$METRO")" ] || { echo "Metro $METRO busy"; exit 70; }
counts | tee "$OUT/counts_before.txt"

say "1. start the lane-1 backend"
: >"$OUT/server.log"
DEMS_CORE_PORT=$PORT npm --prefix "$ROOT" run start:server >"$OUT/server.log" 2>&1 &
NPM_PID=$!; i=0
until [ -n "$(listener $PORT)" ] || ! kill -0 "$NPM_PID" 2>/dev/null || [ "$i" -ge 160 ]; do i=$((i + 1)); sleep 0.25; done
SERVER_PID=$(listener $PORT); [ -n "$SERVER_PID" ] || { echo "backend did not boot"; tail -n 20 "$OUT/server.log"; exit 70; }
echo "$SERVER_PID" >"$ROOT/.locks/core-server.lane1.pid"
echo "npm PID $NPM_PID, listener PID $SERVER_PID"
grep -E 'configuration loaded' "$OUT/server.log" | grep -o '"port":[0-9]*,"database":"[a-z_0-9]*","demoControls":[a-z]*' | sed 's/^/   /'
curl -s "http://127.0.0.1:$PORT/api/v1/health"; echo
HOST_LINES=$(grep -c . "$OUT/server.log")

say "2. device session: phone, Metro $METRO, tcp:4420 -> tcp:$PORT (cap 600 s)"
METRO_PORT=$METRO DEMS_CORE_HOST_PORT=$PORT DEVICE_SESSION_MAX_SECONDS=600 LOCK_WAIT=${LOCK_WAIT:-900} \
  "$ROOT/apps/mobile/scripts/device-session.sh" phone "/bin/sh '$H/device_w74.sh' '$OUT'"
DEVICE_EXIT=$?; echo "device session exit=$DEVICE_EXIT"

say "3. backend requests during the session"
tail -n +$((HOST_LINES + 1)) "$OUT/server.log" >"$OUT/server_device_part.log"
grep '"msg":"request completed"' "$OUT/server_device_part.log" | sed -E 's/.*"method":"([^"]*)","route":"([^"]*)","status":([0-9]*).*"principal":([^,}]*).*/\1 \2 \3 principal=\4/' | sed -E 's/principal="?(operator|device|null)[^ ]*/principal=\1/' | sort | uniq -c | sed 's/^/   /'
echo "-- bearer/cookie/credential lines in the server log (must be 0): $(grep -c -E 'dvc_|ses_|bio_|[Bb]earer |[Cc]ookie' "$OUT/server.log")"

say "4. stop the backend; nothing left"
kill "$SERVER_PID" 2>/dev/null; i=0; while [ -n "$(listener $PORT)" ] && [ "$i" -lt 40 ]; do i=$((i + 1)); sleep 0.25; done
kill "$NPM_PID" 2>/dev/null; wait "$NPM_PID" 2>/dev/null
: >"$ROOT/.locks/core-server.lane1.pid"
lsof -nP -iTCP:$PORT -iTCP:"$METRO" -sTCP:LISTEN; echo "lsof exit $? (1 = none)"
adb -s emulator-5554 reverse --list; echo "reverse rules listed above (none expected)"
counts | tee "$OUT/counts_after.txt"
say "end"; exit "$DEVICE_EXIT"
