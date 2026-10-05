#!/bin/sh
# W05 (early proof f) live check on lane 1. Run from the repository root, never from a subfolder:
#   /usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_check.sh
# Starts: the proof harness (127.0.0.1:4421), Vite (127.0.0.1:5176) three times, headless Chromium
# (DevTools 127.0.0.1:9396). Stops everything it started. Touches no other process and no other port.
set -u
K=1; PORT=$((4420 + K)); VITE=$((5175 + K)); DEV=9396
H=.cache/proof-harness; OUT=$H/out; LOCKS=.locks; HLOG=$H/harness.log
CHROME="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell"
ORIGIN="http://127.0.0.1:$VITE"
HPID=""; NPID=""; VPID=""; CPID=""

stamp() { date '+%H:%M:%S'; }
mask() { sed -E 's/(dems_session_[0-9]+=)([A-Za-z0-9_-]{6})[A-Za-z0-9_-]*/\1\2[rest not shown]/g'; }
hdr() { tr -d '\r' | grep -i -E '^(HTTP/|set-cookie|x-dems-|retry-after|access-control-|vary|content-type|cache-control|allow)' | mask; }
listening() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
show_listeners() { lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk -v re="$1" '$9 ~ re {print "   " $1, "pid " $2, $9}'; }
wait_listen() { i=0; until listening "$1" || [ $i -ge 120 ]; do i=$((i + 1)); sleep 0.25; done; listening "$1"; }
wait_free() { i=0; while listening "$1" && [ $i -lt "${2:-20}" ]; do i=$((i + 1)); sleep 0.25; done; ! listening "$1"; }
wait_gone() { i=0; while kill -0 "$1" 2>/dev/null && [ $i -lt "${2:-20}" ]; do i=$((i + 1)); sleep 0.25; done; ! kill -0 "$1" 2>/dev/null; }
marker() { echo "{\"marker\":\"$1\"}" >> "$HLOG"; }
post() { curl -s -o /dev/null -D - -X POST -H 'content-type: application/json' -d '{}' "$@"; }

cleanup() {
  [ -n "$CPID" ] && kill "$CPID" 2>/dev/null
  [ -n "$VPID" ] && kill "$VPID" 2>/dev/null
  [ -n "$NPID" ] && kill "$NPID" 2>/dev/null
  [ -n "$HPID" ] && kill "$HPID" 2>/dev/null
  rm -f "$LOCKS/core-server.lane$K.pid" "$OUT/jar"
  rm -rf "$OUT/chrome-profile"
}
trap cleanup EXIT

start_vite() { # $1 = log file; the rest = environment assignments for this start
  log="$1"; shift
  env "$@" npm run dev -w @dems/core-web -- --host 127.0.0.1 --port $VITE --strictPort > "$log" 2>&1 &
  NPID=$!
}

rm -rf "$OUT"; mkdir -p "$OUT"
echo "== $(stamp) 0. pre-state ($(date '+%Y-%m-%d %Z'), node $(node -v), cwd $(pwd))"
echo "-- listeners on the ports of the port table, all addresses (name, pid, address):"
show_listeners ':(4400|441[0-9]|442[0-9]|4432|517[0-9]|4173|9396)$'
lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk '$9 ~ /:(5173|5174|5175)$/ {print $1, $2, $9}' | sort > "$OUT/other_project_before.txt"
echo "-- (end; an empty list means none)"
for p in $PORT $VITE $DEV; do if listening $p; then echo "ABORT: port $p is already in use"; exit 9; fi; done

echo
echo "== $(stamp) 1. start the proof harness on 127.0.0.1:$PORT"
node $H/harness.mjs > "$OUT/harness.stdout" 2>&1 &
HPID=$!; echo "$HPID" > "$LOCKS/core-server.lane$K.pid"
wait_listen $PORT || { echo "ABORT: the harness did not start"; cat "$OUT/harness.stdout"; exit 8; }
cat "$OUT/harness.stdout"; show_listeners ":$PORT\$"

echo
echo "== $(stamp) 2. start Vite for lane $K: DEMS_CORE_PROXY_PORT=$PORT VITE_DEMS_CORE_MODE=live npm run dev -w @dems/core-web -- --host 127.0.0.1 --port $VITE --strictPort"
start_vite "$OUT/vite_proxy.log" DEMS_CORE_PROXY_PORT=$PORT VITE_DEMS_CORE_MODE=live
wait_listen $VITE || { echo "ABORT: Vite did not start"; cat "$OUT/vite_proxy.log"; exit 7; }
VPID=$(lsof -nP -tiTCP:$VITE -sTCP:LISTEN)
echo "PID of the background job (npm): $NPID; PID of the listener on $VITE: $VPID"
ps -o pid=,ppid=,command= -p "$NPID" -p "$VPID" | cut -c1-150 | sed 's/^/   /'
echo "-- parent chain of the listener:"; p=$VPID; while [ "$p" != "$NPID" ] && [ "$p" -gt 1 ]; do p=$(ps -o ppid= -p "$p" | tr -d ' '); echo "   parent $p: $(ps -o command= -p "$p" | cut -c1-90)"; done
show_listeners ":$VITE\$"
grep -v '^$' "$OUT/vite_proxy.log" | grep -v 'trust settings' | head -8 | sed 's/^/   /'

echo
echo "== $(stamp) 3. curl through the dev server ($ORIGIN)"
marker "3a curl POST sign-in through $VITE, Origin $ORIGIN"
echo "-- 3a. POST /api/v1/proof/sign-in  (curl -si, Origin: $ORIGIN):"
post -c "$OUT/jar" -H "Origin: $ORIGIN" "$ORIGIN/api/v1/proof/sign-in" | hdr
marker "3b curl POST echo through $VITE with the cookie, Origin $ORIGIN"
echo "-- 3b. the next request, with the cookie: POST /api/v1/proof/echo"
curl -s -i -X POST -H 'content-type: application/json' -d '{}' -b "$OUT/jar" -H "Origin: $ORIGIN" "$ORIGIN/api/v1/proof/echo" | tr -d '\r' | grep -i -E '^(HTTP/|x-dems-|access-control-|vary|\{)' | mask
marker "3c curl GET health through $VITE, no Origin"
echo "-- 3c. GET /api/v1/health without an Origin header (all response headers):"
curl -s -i "$ORIGIN/api/v1/health" | tr -d '\r' | mask
echo
marker "3d curl POST limited through $VITE"
echo "-- 3d. POST /api/v1/proof/limited (a 429 with retry-after):"
post -H "Origin: $ORIGIN" "$ORIGIN/api/v1/proof/limited" | hdr
marker "3e negative: Origin http://localhost:$VITE, http://127.0.0.1:5174, null, none"
echo "-- 3e. negative cases through the dev server, POST /api/v1/proof/guarded (the harness stands in for the Origin guard):"
for o in "http://localhost:$VITE" "http://127.0.0.1:5174" "null" "http://127.0.0.1:$VITE/" "HTTP://127.0.0.1:$VITE" "$ORIGIN"; do
  printf '   Origin: %-28s -> ' "$o"; curl -s -o "$OUT/body.txt" -w '%{http_code} ' -X POST -H 'content-type: application/json' -d '{}' -H "Origin: $o" "$ORIGIN/api/v1/proof/guarded"; cut -c1-70 "$OUT/body.txt"; echo
done
printf '   %-36s -> ' "(no Origin header)"; curl -s -o "$OUT/body.txt" -w '%{http_code} ' -X POST -H 'content-type: application/json' -d '{}' "$ORIGIN/api/v1/proof/guarded"; cut -c1-70 "$OUT/body.txt"; echo
marker "3f direct to $PORT (for the header comparison)"
echo "-- 3f. response headers of the same POST, direct to $PORT against through $VITE (date and revision normalised):"
norm() { tr -d '\r' | grep -v '^$' | tr 'A-Z' 'a-z' | sed -E 's/^(x-dems-revision|date|content-length): .*/\1: (varies)/' | sort; }
post -H "Origin: $ORIGIN" "http://127.0.0.1:$PORT/api/v1/proof/echo" | norm > "$OUT/direct.h"
post -H "Origin: $ORIGIN" "$ORIGIN/api/v1/proof/echo" | norm > "$OUT/proxied.h"
if diff "$OUT/direct.h" "$OUT/proxied.h" > "$OUT/headers.diff"; then echo "   identical header sets"; else echo "   differences (< direct, > through the dev server):"; sed 's/^/   /' "$OUT/headers.diff"; fi
marker "3g preflight OPTIONS through $VITE from http://127.0.0.1:5174"
echo "-- 3g. a CORS preflight sent to the dev server from another loopback origin (http://127.0.0.1:5174):"
curl -s -i -X OPTIONS -H 'Origin: http://127.0.0.1:5174' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type' "$ORIGIN/api/v1/proof/echo" | tr -d '\r' | grep -v '^$' | head -12 | sed 's/^/   /'
echo "-- 3g2. the same preflight from a non-loopback origin (https://example.org):"
curl -s -i -X OPTIONS -H 'Origin: https://example.org' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type' "$ORIGIN/api/v1/proof/echo" | tr -d '\r' | grep -v '^$' | head -12 | sed 's/^/   /'
marker "3h ws client through $VITE with the cookie, Origin $ORIGIN"
echo "-- 3h. socket upgrade through the dev server with the cookie (node ws client):"
node $H/ws-client.mjs "ws://127.0.0.1:$VITE/ws" --origin "$ORIGIN" --cookie-jar "$OUT/jar" --send ping-curl | sed 's/^/   /'
marker "3i ws client through $VITE, Origin http://localhost:$VITE, no cookie"
echo "-- 3i. socket upgrade with Origin http://localhost:$VITE (negative case: what reaches the server):"
node $H/ws-client.mjs "ws://127.0.0.1:$VITE/ws" --origin "http://localhost:$VITE" --send ping-localhost | sed 's/^/   /'
echo "-- 3j. Vite's own endpoints with the proxy block present:"
for u in / /src/main.tsx /@vite/client; do printf '   GET %-16s -> ' "$u"; curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "$ORIGIN$u"; done
echo "-- 3k. Vite's own socket (subprotocol vite-hmr on /), node ws client without an Origin:"
node $H/ws-client.mjs "ws://127.0.0.1:$VITE/" --protocol vite-hmr | sed 's/^/   /'

echo
echo "== $(stamp) 4. headless Chromium over CDP (DevTools 127.0.0.1:$DEV)"
if [ -x "$CHROME" ]; then
  marker "4 browser run: page $ORIGIN, then page http://localhost:$VITE"
  "$CHROME" --remote-debugging-port=$DEV --remote-debugging-address=127.0.0.1 --user-data-dir="$(pwd)/$OUT/chrome-profile" --no-first-run --disable-background-networking --disable-component-update --disable-sync --disable-default-apps --disable-domain-reliability --host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost" --window-size=1280,800 about:blank > "$OUT/chrome.log" 2>&1 &
  CPID=$!; echo "chrome pid $CPID"
  i=0; until curl -s -o /dev/null "http://127.0.0.1:$DEV/json/version" || [ $i -ge 80 ]; do i=$((i + 1)); sleep 0.25; done
  curl -s "http://127.0.0.1:$DEV/json/version" | grep -E '"Browser"' | sed 's/^/   /'
  show_listeners ":$DEV\$"
  node $H/cdp-driver.mjs $DEV $VITE "$OUT/browser_run.json" > "$OUT/browser_run.stdout" 2>&1; echo "driver exit $?"
  kill "$CPID" 2>/dev/null; wait "$CPID" 2>/dev/null; echo "chrome stopped"; CPID=""
  rm -rf "$OUT/chrome-profile"
  echo "-- result file: $OUT/browser_run.json ($(wc -c < "$OUT/browser_run.json" | tr -d ' ') bytes)"
else
  echo "NOT DONE: no headless Chromium at $CHROME"
fi
echo "-- Vite log after the browser run (proxy errors would show here):"
grep -v '^$' "$OUT/vite_proxy.log" | grep -v 'trust settings' | sed -n '4,20p' | sed 's/^/   /'; echo "   (end)"

echo
echo "== $(stamp) 5. stop Vite, way A: SIGTERM to the PID of the background job (npm, $NPID)"
kill "$NPID"
if wait_free $VITE 20; then echo "port $VITE was released within 5 s after the kill of the npm PID"; else echo "port $VITE STILL LISTENING 5 s after the kill of the npm PID; killing the listener $VPID"; kill "$VPID"; wait_free $VITE 20 && echo "port $VITE released after the kill of the listener"; fi
wait "$NPID" 2>/dev/null; echo "npm job exit status: $?"
if kill -0 "$VPID" 2>/dev/null; then echo "listener pid $VPID still alive"; else echo "listener pid $VPID gone"; fi
NPID=""; VPID=""

echo
echo "== $(stamp) 6. Vite WITHOUT DEMS_CORE_PROXY_PORT (the dev server as before)"
before=$(grep -c -E '"kind":"(http|upgrade)"' "$HLOG")
marker "6 Vite without the variable: nothing below this line may come from port $VITE"
start_vite "$OUT/vite_noproxy.log" -u DEMS_CORE_PROXY_PORT
wait_listen $VITE || { echo "ABORT: Vite did not start"; cat "$OUT/vite_noproxy.log"; exit 6; }
VPID=$(lsof -nP -tiTCP:$VITE -sTCP:LISTEN); echo "npm pid $NPID, listener pid $VPID"
printf -- '-- GET /api/v1/health          -> '; curl -s -o "$OUT/body.txt" -w '%{http_code} %{content_type}' "$ORIGIN/api/v1/health"; echo "; body starts: $(head -c 60 "$OUT/body.txt" | tr '\n' ' ')"
echo "-- POST /api/v1/proof/sign-in  ->"; post -H "Origin: $ORIGIN" "$ORIGIN/api/v1/proof/sign-in" | tr -d '\r' | grep -v '^$' | mask | sed 's/^/   /'
echo "-- socket /ws:"; node $H/ws-client.mjs "ws://127.0.0.1:$VITE/ws" --origin "$ORIGIN" --send ping-noproxy | sed 's/^/   /'
echo "-- Vite's own socket:"; node $H/ws-client.mjs "ws://127.0.0.1:$VITE/" --protocol vite-hmr | sed 's/^/   /'
after=$(grep -c -E '"kind":"(http|upgrade)"' "$HLOG")
echo "-- requests the harness logged before / after this phase: $before / $after"
echo "-- stop Vite, way B: SIGTERM to the listener PID ($VPID), found by the port"
kill "$VPID"
if wait_free $VITE 20; then echo "port $VITE released"; else echo "port $VITE STILL LISTENING"; fi
if wait_gone "$NPID" 20; then wait "$NPID" 2>/dev/null; echo "the npm job ($NPID) ended by itself, exit status $?"; else echo "the npm job ($NPID) is still alive after 5 s; killing it"; kill "$NPID"; fi
NPID=""; VPID=""

echo
echo "== $(stamp) 7. Vite with an invalid value: DEMS_CORE_PROXY_PORT=9999"
start_vite "$OUT/vite_invalid.log" DEMS_CORE_PROXY_PORT=9999
if wait_gone "$NPID" 60; then wait "$NPID" 2>/dev/null; echo "the dev server command ended by itself, exit status $?"; else echo "FAIL: still running after 15 s"; VPID=$(lsof -nP -tiTCP:$VITE -sTCP:LISTEN); fi
grep -v '^$' "$OUT/vite_invalid.log" | grep -v 'trust settings' | cut -c1-200 | head -9 | sed 's/^/   /'
if listening $VITE; then echo "port $VITE is LISTENING (unexpected)"; else echo "port $VITE is not bound"; fi
[ -n "$VPID" ] && kill "$VPID"; NPID=""; VPID=""

echo
echo "== $(stamp) 8. the harness log (cookie value cut to 6 characters)"
node $H/format-log.mjs "$HLOG"

echo
echo "== $(stamp) 9. stop the harness and check that nothing is left"
kill "$HPID"; wait "$HPID" 2>/dev/null; echo "harness exit status: $?"; HPID=""
rm -f "$LOCKS/core-server.lane$K.pid" "$OUT/jar"
sleep 0.5
echo "-- lsof -nP -iTCP:$PORT -iTCP:$VITE -iTCP:$DEV -sTCP:LISTEN"
lsof -nP -iTCP:$PORT -iTCP:$VITE -iTCP:$DEV -sTCP:LISTEN; echo "   (lsof exit $?; 1 with no output means no listener)"
lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk '$9 ~ /:(5173|5174|5175)$/ {print $1, $2, $9}' | sort > "$OUT/other_project_after.txt"
if diff "$OUT/other_project_before.txt" "$OUT/other_project_after.txt" > /dev/null; then echo "-- listeners on 5173, 5174, 5175: unchanged ($(wc -l < "$OUT/other_project_after.txt" | tr -d ' ') lines before and after)"; else echo "-- listeners on 5173-5175 CHANGED:"; diff "$OUT/other_project_before.txt" "$OUT/other_project_after.txt"; fi
echo "-- processes of this check still alive:"; pgrep -fl "proof-harness/harness.mjs|chrome-headless-shell|--port $VITE" || echo "   (none)"
echo "== $(stamp) done"
