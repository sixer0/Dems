#!/bin/sh
# W12 (early proof e): the registry-driven typed client on an emulator.
# Run from the repository root, inside the lane lock (sandbox bypass: port binding, adb):
#   /usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_w12.sh
# Env: SKIP_DEVICE=1 (host control run only), METRO_PORT (default 8082), LOCK_WAIT (device lock, default 900 s).
set -u
ROOT=/Users/gsp-budi/Documents/DEMS
H="$ROOT/.cache/proof-harness"
OUT="$H/out_w12"
PORT=4421
METRO=${METRO_PORT:-8082}
RUN="w12x$(date +%H%M%S)"
mkdir -p "$OUT"
say() { printf '\n== %s %s\n' "$(date '+%H:%M:%S')" "$*"; }

say "0. before: run id $RUN; listeners on $PORT and on the Metro ports"
if lsof -nP -iTCP:$PORT -sTCP:LISTEN; then
  echo "port $PORT is busy; not starting"
  exit 70
fi
lsof -nP -iTCP:8081-8086 -sTCP:LISTEN || echo "(no Metro listening on 8081-8086)"
uptime

say "1. start the proof harness on 127.0.0.1:$PORT (node --import tsx)"
PROOF_HARNESS_LOG="$OUT/harness.log" node --import tsx "$H/harness.mjs" >"$OUT/harness.stdout" 2>&1 &
HPID=$!
echo "$HPID" >"$ROOT/.locks/core-server.lane1.pid"
i=0
until lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1 || ! kill -0 "$HPID" 2>/dev/null || [ "$i" -ge 80 ]; do
  i=$((i + 1))
  sleep 0.25
done
cat "$OUT/harness.stdout"
if ! lsof -nP -iTCP:$PORT -sTCP:LISTEN; then
  echo "the harness did not start"
  kill "$HPID" 2>/dev/null
  rm -f "$ROOT/.locks/core-server.lane1.pid"
  exit 70
fi

say "2. host control run: the same client under Node against the harness"
node --import tsx "$H/host_control_w12.mjs" "$RUN" 2>&1 | tee "$OUT/host_control.txt"
grep -c . "$OUT/harness.log" | sed 's/^/harness log lines after the host control run: /'
HOST_LINES=$(grep -c . "$OUT/harness.log")

if [ "${SKIP_DEVICE:-0}" != 1 ]; then
  say "3. device session: dems_phone, Metro $METRO, device tcp:4420 -> host tcp:$PORT"
  METRO_PORT=$METRO DEMS_CORE_HOST_PORT=$PORT DEVICE_SESSION_MAX_SECONDS=600 LOCK_WAIT=${LOCK_WAIT:-900} \
    "$ROOT/apps/mobile/scripts/device-session.sh" phone "/bin/sh '$H/device_w12.sh' '$RUN' '$OUT'"
  echo "device session exit=$?"
  echo "$HOST_LINES" >"$OUT/host_lines.txt"
fi

say "4. stop the harness and check that nothing is left"
kill "$HPID"
wait "$HPID" 2>/dev/null
echo "harness exit status: $?"
rm -f "$ROOT/.locks/core-server.lane1.pid"
i=0
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1 && [ "$i" -lt 20 ]; do
  i=$((i + 1))
  sleep 0.25
done
lsof -nP -iTCP:$PORT -iTCP:$METRO -sTCP:LISTEN
echo "lsof exit $? (1 with no output: no listener on $PORT or $METRO)"
say "end of run $RUN"
