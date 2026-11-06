#!/bin/sh
# W60 device check, session B (the D138 LIVE sign-in). Lane 1, phone. The lane database is NOT reset
# here: the phone is already paired with dems_lane_1 from session A, and the credential must survive.
# Run INSIDE the lane lock: /usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/w60/run_w60b.sh
set -u
ROOT=/Users/gsp-budi/Documents/DEMS; H="$ROOT/.cache/w60"; OUT="$H/out"; PORT=4421; METRO=${METRO_PORT:-8083}
RUN="w60fx$(date +%H%M%S)"; mkdir -p "$OUT"
say() { printf '\n== %s %s\n' "$(date '+%H:%M:%S')" "$*"; }
listener() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -n 1; }
counts() { (cd "$ROOT" && npm run db:status -w @dems/core-server -- --database dems_lane_1 2>&1) | grep -E "^ +(paired_devices|device_credentials|sessions|audit_log) +[0-9]+|db:status:" | sed 's/^ */   /'; }

say "0. before (no reset): listeners free?; dems_lane_1 as session A left it"
[ -z "$(listener $PORT)" ] || { echo "port $PORT busy"; exit 70; }
[ -z "$(listener "$METRO")" ] || { echo "Metro $METRO busy"; exit 70; }
counts | tee "$OUT/f_counts_before.txt"

say "1. start the lane backend (demo flag off)"
: >"$OUT/server_f.log"
(cd "$ROOT" && DEMS_CORE_PORT=$PORT exec npm run start:server) >"$OUT/server_f.log" 2>&1 &
NPM_PID=$!; i=0
until [ -n "$(listener $PORT)" ] || ! kill -0 "$NPM_PID" 2>/dev/null || [ "$i" -ge 160 ]; do i=$((i + 1)); sleep 0.25; done
SERVER_PID=$(listener $PORT); [ -n "$SERVER_PID" ] || { echo "backend did not boot"; tail -n 20 "$OUT/server_f.log"; exit 70; }
echo "$SERVER_PID" >"$ROOT/.locks/core-server.lane1.pid"
echo "npm PID $NPM_PID, listener PID $SERVER_PID"
grep -E 'configuration loaded' "$OUT/server_f.log" | grep -o '"port":[0-9]*,"database":"[a-z_0-9]*","demoControls":[a-z]*' | sed 's/^/   /'
curl -s "http://127.0.0.1:$PORT/api/v1/health" | tee "$OUT/health_b.json"; echo
HOST_LINES=$(grep -c . "$OUT/server_f.log")

say "2. device session: phone, Metro $METRO, tcp:4420 -> tcp:$PORT"
METRO_PORT=$METRO DEMS_CORE_HOST_PORT=$PORT DEVICE_SESSION_MAX_SECONDS=480 LOCK_WAIT=${LOCK_WAIT:-900} \
  "$ROOT/apps/mobile/scripts/device-session.sh" phone "/bin/sh '$H/device_w60f.sh' '$RUN' '$OUT' '$OUT/server_f.log' '$PORT'"
DEVICE_EXIT=$?; echo "device session exit=$DEVICE_EXIT"; echo "$DEVICE_EXIT" >"$OUT/f_device_exit.txt"

say "3. backend request log during the session"
tail -n +$((HOST_LINES + 1)) "$OUT/server_f.log" >"$OUT/server_f_device_part.log"
grep '"msg":"request completed"' "$OUT/server_f_device_part.log" | sed -E 's/.*"method":"([^"]*)","route":"([^"]*)","status":([0-9]*).*"principal":([^,}]*).*/\1 \2 \3 principal=\4/' | sed -E 's/principal="?(operator|device|null)[^ ]*/principal=\1/' | sort | uniq -c | sed 's/^/   /'
echo "-- bearer/cookie/credential lines in the server log this run (must be 0): $(grep -c -E 'dvc_|ses_|bio_|[Bb]earer |[Cc]ookie' "$OUT/server_f.log")"

say "4. stop the backend and check nothing is left"
kill "$SERVER_PID" 2>/dev/null; i=0; while [ -n "$(listener $PORT)" ] && [ "$i" -lt 40 ]; do i=$((i + 1)); sleep 0.25; done
kill "$NPM_PID" 2>/dev/null; wait "$NPM_PID" 2>/dev/null
: >"$ROOT/.locks/core-server.lane1.pid"
lsof -nP -iTCP:$PORT -iTCP:"$METRO" -sTCP:LISTEN; echo "lsof exit $? (1 = none)"
counts | tee "$OUT/f_counts_after.txt"
say "end of run $RUN"; exit "$DEVICE_EXIT"
