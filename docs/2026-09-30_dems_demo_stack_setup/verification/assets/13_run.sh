#!/bin/sh
# Step 96b: start the extracted macOS arm64 launcher on 127.0.0.1:4421, drive headless Chromium over CDP, stop both.
# Touches only port 4421 (launcher) and 9396 (DevTools, loopback). Kills only the two PIDs it starts.
W="$1"; ASSETS="$2"; ROOT="$3"; PORT=4421; DEV=9396
EXE="$W/arm64/DEMS-Web-Demo-0.1.0-macos-arm64/DEMS Web Demo"
CHROME="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell"
OUT="$W/${4:-out}"; mkdir -p "$OUT"; rm -rf "$OUT/chrome-profile"
echo "== $(date '+%H:%M:%S %Z') pre-state"
echo "listeners on forbidden/used ports before:"; lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR==1 || /:(4400|4410|4420|4421|5173|5174|5175|8081|9396) /'
echo "pre-existing launcher/headless processes:"; pgrep -fl "DEMS Web Demo|dems-web-launcher|chrome-headless-shell" || echo "(none)"
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1 || lsof -nP -iTCP:$DEV -sTCP:LISTEN >/dev/null 2>&1; then echo "ABORT: port $PORT or $DEV already in use"; exit 9; fi

echo "== $(date '+%H:%M:%S') start launcher --no-open --port $PORT"
"$EXE" --no-open --port $PORT > "$OUT/launcher.log" 2>&1 &
PID=$!; echo "launcher pid $PID"
i=0; until curl -s -o /dev/null "http://127.0.0.1:$PORT/api/v1/health" || [ $i -ge 120 ]; do i=$((i+1)); sleep 0.25; done
echo "-- launcher banner:"; cat "$OUT/launcher.log"
echo "-- health:"; curl -s -o "$OUT/health.json" -D "$OUT/health.headers" -w 'http=%{http_code}\n' "http://127.0.0.1:$PORT/api/v1/health"; cat "$OUT/health.json"; echo
echo "-- CSP header on /:"; curl -s -o /dev/null -D - "http://127.0.0.1:$PORT/" | grep -i '^content-security-policy'
echo "-- lsof -nP -a -p $PID -i (all sockets of the launcher):"; lsof -nP -a -p $PID -i 2>/dev/null
echo "-- any listener on port $PORT (all addresses):"; lsof -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null

echo "== $(date '+%H:%M:%S') start headless Chromium (DevTools 127.0.0.1:$DEV)"
"$CHROME" --remote-debugging-port=$DEV --remote-debugging-address=127.0.0.1 --user-data-dir="$OUT/chrome-profile" --no-first-run --disable-background-networking --disable-component-update --disable-sync --disable-default-apps --disable-domain-reliability --host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost" --window-size=1600,1000 about:blank > "$OUT/chrome.log" 2>&1 &
CPID=$!; echo "chrome pid $CPID"
i=0; until curl -s -o /dev/null "http://127.0.0.1:$DEV/json/version" || [ $i -ge 120 ]; do i=$((i+1)); sleep 0.25; done
curl -s "http://127.0.0.1:$DEV/json/version" | grep -E '"Browser"|"Protocol-Version"'

echo "== $(date '+%H:%M:%S') CDP driver"
node "$W/cdp-reverify-96b.mjs" $DEV "http://127.0.0.1:$PORT" "$ASSETS" "$ROOT"; echo "driver exit $?"
echo "== $(date '+%H:%M:%S') sockets of the headless browser and its children (TCP), DevTools port excluded:"
CH="$CPID $(pgrep -P $CPID | tr '\n' ' ')"
for p in $CH; do lsof -nP -a -p $p -iTCP 2>/dev/null | grep -v "^COMMAND" ; done | grep -v ":$DEV" | awk '{print $1, $2, $8, $9, $10}' | sort | uniq -c | head -20
echo "(end sockets)"
echo "-- health after the walk:"; curl -s -w ' http=%{http_code}\n' "http://127.0.0.1:$PORT/api/v1/health"

echo "== $(date '+%H:%M:%S') stop"
kill $CPID 2>/dev/null; wait $CPID 2>/dev/null; echo "chrome stopped (exit $?)"
kill -INT $PID; wait $PID; echo "launcher exit after SIGINT: $?"
echo "-- launcher log tail:"; tail -4 "$OUT/launcher.log"
sleep 1
echo "-- listeners on $PORT/$DEV after stop:"; lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | grep -E ":($PORT|$DEV) " || echo "none"
echo "-- launcher/headless processes after stop:"; pgrep -fl "DEMS Web Demo|dems-web-launcher|chrome-headless-shell" || echo "(none)"
echo "-- user servers still listening (must be unchanged):"; lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk '/:(4400|5173|5174|5175|8081) /{print $1, $2, $9}'
echo "== $(date '+%H:%M:%S') done"
