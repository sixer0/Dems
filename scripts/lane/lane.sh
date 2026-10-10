#!/bin/sh
# DEMS Core lanes: ONE place for the start, stop, status and reset of the main instance and the
# three lane instances (task 3, decisions D171 / D174 / D175; plan in
# docs/2026-10-07_dems_real_capture_sealing/initialization/04_gate_environment_wave_f.md).
#
#   scripts/lane/lane.sh start  <main|1|2|3>   start that Core detached, wait until it is ready
#   scripts/lane/lane.sh stop   <main|1|2|3>   stop that Core (TERM to the listener of its port)
#   scripts/lane/lane.sh status                what listens on 4420-4423, and the plan of each
#   scripts/lane/lane.sh reset  <main|1|2|3>   db:reset of that database, under the migrate lock
#
# Run it OUTSIDE the sandbox (loopback bind, PostgreSQL), from any directory.
#
# WHY A SCRIPT. Every standing database has its OWN media store root (D171), and the Core records
# the root it was started with. A start or a reset with another DEMS_MEDIA_DIR makes the next
# reset answer RESET_STORE_ROOT_CONFLICT, and a plain "npm run start:server" on 4420 records the
# old shared root again. This script is the one place the per-lane environment is written down:
#
#   lane  port  database     capture operation   demo controls  media store root
#   main  4420  dems_demo    SIMULATED           on             .data/media/dems_demo/sessions
#   1     4421  dems_lane_1  SIMULATED           on             .data/media/dems_lane_1/sessions
#   2     4422  dems_lane_2  REAL_DEVELOPMENT    unset          .data/media/dems_lane_2/sessions
#   3     4423  dems_lane_3  SIMULATED           unset          .data/media/dems_lane_3/sessions
#
# Lane 2 is development capture: DEMS_CAPTURE_MODE=real, DEMS_CAPTURE_DEV_SOURCES=1, the helper
# program (.data/helpers/ffmpeg, "npm run capture:dev-setup") and the capture worker
# (apps/capture-worker/build/capture-worker, "make -C apps/capture-worker"). It also needs the
# development signing key ("npm run evidence:dev-key -w @dems/core-server") and the transcriber
# host file (.data/transcriber/host.json); the Core's own boot checks refuse a start without them.
#
# WHAT IT NEVER DOES. It reads no connection file and no key: it calls the project's npm scripts,
# which load what they need. It sets no attendance variable and selects no capture source. It
# touches no port outside 4420-4423 and stops only the listener of the lane it was asked for.
# Web dev servers, Metro and the device rules are not started here (see the note above, section 7).
#
# Exit codes: 0 done; 64 usage or unknown lane; 69 the lane is in the wrong state (already
# running, not running, a prerequisite of lane 2 is missing); 70 the Core did not become ready.

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P) || exit 70
LOCKS="$ROOT/.locks"
READY_SECONDS=${LANE_READY_SECONDS:-40}

usage() {
  echo "usage: $0 start|stop|reset <main|1|2|3>   |   $0 status" >&2
  exit 64
}

# Sets PORT, DATABASE, MODE, DEMO, LOG for a lane, or stops on an unknown one.
plan() {
  case "$1" in
    main) PORT=4420; DATABASE=dems_demo;   MODE=SIMULATED;        DEMO=on;    LOG="$LOCKS/core-server.demo.log" ;;
    1)    PORT=4421; DATABASE=dems_lane_1; MODE=SIMULATED;        DEMO=on;    LOG="$LOCKS/core-server.lane1.log" ;;
    2)    PORT=4422; DATABASE=dems_lane_2; MODE=REAL_DEVELOPMENT; DEMO=unset; LOG="$LOCKS/core-server.lane2.log" ;;
    3)    PORT=4423; DATABASE=dems_lane_3; MODE=SIMULATED;        DEMO=unset; LOG="$LOCKS/core-server.lane3.log" ;;
    *)    echo "lane.sh: unknown lane '$1' (one of main, 1, 2, 3)" >&2; exit 64 ;;
  esac
  MEDIA="$ROOT/.data/media/$DATABASE/sessions"
  HELPER="$ROOT/.data/helpers/ffmpeg"
  WORKER="$ROOT/apps/capture-worker/build/capture-worker"
}

listener() { lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -n 1; }

say_plan() {
  echo "lane.sh: lane $1 = port $PORT, database $DATABASE, capture operation $MODE, demo controls $DEMO"
  echo "lane.sh: media store root $MEDIA"
  if [ "$MODE" = REAL_DEVELOPMENT ]; then
    echo "lane.sh: lane 2 records from the FAKE (generated) sources: its selector is CAM-01, CAM-02, MIC-01, MIC-02. A selector naming this Mac's camera or microphone (LOCAL_DEVICE) is the user's own run, never an agent's."
  fi
}

# The environment of a lane, for "env": the variables of the plan and nothing else of the capture
# family (a value inherited from the caller's shell must not change the plan).
lane_env() {
  set -- -u DEMS_CAPTURE_MODE -u DEMS_CAPTURE_DEV_SOURCES -u DEMS_CAPTURE_HELPER_FFMPEG -u DEMS_CAPTURE_WORKER \
    -u DEMS_DEMO_CONTROLS -u DEMS_CORE_PORT -u DEMS_LOCAL_SESSION_ATTENDED -u DEMS_USER_ATTENDED \
    "DEMS_MEDIA_DIR=$MEDIA"
  if [ "$MODE" = REAL_DEVELOPMENT ]; then
    set -- "$@" DEMS_CAPTURE_MODE=real DEMS_CAPTURE_DEV_SOURCES=1 "DEMS_CAPTURE_HELPER_FFMPEG=$HELPER" "DEMS_CAPTURE_WORKER=$WORKER"
  fi
  [ "$DEMO" = on ] && set -- "$@" DEMS_DEMO_CONTROLS=1
  # The words hold no blank: a repository path with a blank is refused by check_root.
  LANE_ENV=$*
}

check_root() {
  case "$ROOT" in *[[:space:]]*) echo "lane.sh: the repository path holds a blank; this script does not support it" >&2; exit 69 ;; esac
}

check_real_prerequisites() {
  [ "$MODE" = REAL_DEVELOPMENT ] || return 0
  [ -x "$HELPER" ] || { echo "lane.sh: the helper program is missing: run 'npm run capture:dev-setup'" >&2; exit 69; }
  [ -x "$WORKER" ] || { echo "lane.sh: the capture worker is missing: run 'make -C apps/capture-worker'" >&2; exit 69; }
}

cmd_start() {
  plan "$1"; check_root; say_plan "$1"; check_real_prerequisites
  pid=$(listener "$PORT")
  if [ -n "$pid" ]; then echo "lane.sh: port $PORT already has a listener (PID $pid): not started" >&2; exit 69; fi
  lane_env
  mkdir -p "$LOCKS"
  mkdir -p "$MEDIA" && chmod 700 "$MEDIA"  # fix F-M7b: the lane's own media store root (.data/media/<database>/sessions), owner-only; a real-mode Core refuses any other mode (READABLE_BY_OTHERS)
  # shellcheck disable=SC2086 -- LANE_ENV is a list of blank-free words by check_root
  ( cd "$ROOT" && nohup env $LANE_ENV "DEMS_CORE_PORT=$PORT" npm run -s start:server >"$LOG" 2>&1 & )
  waited=0
  while [ "$waited" -lt "$READY_SECONDS" ]; do
    if curl -s -m 2 "http://127.0.0.1:$PORT/api/v1/health" 2>/dev/null | grep -q '"ready":{"database":true,"engine":true}'; then
      echo "lane.sh: lane $1 is ready on 127.0.0.1:$PORT (PID $(listener "$PORT")); log $LOG"
      return 0
    fi
    # The Core stops by itself on a failed boot check: no listener and a final line in the log.
    if grep -q '"msg":"the server stopped: boot"' "$LOG" 2>/dev/null; then
      echo "lane.sh: the Core of lane $1 stopped at boot; the check is named in $LOG:" >&2
      grep '"msg":"the server stopped: boot"' "$LOG" | sed -E 's/.*"check":"([^"]*)".*"code":"([^"]*)".*/  check \1, code \2/' >&2
      exit 70
    fi
    /bin/sleep 1; waited=$((waited + 1))
  done
  echo "lane.sh: lane $1 did not become ready within ${READY_SECONDS}s; log $LOG" >&2
  exit 70
}

cmd_stop() {
  plan "$1"
  pid=$(listener "$PORT")
  if [ -z "$pid" ]; then echo "lane.sh: lane $1 is not running (nothing listens on $PORT)"; return 0; fi
  kill -TERM "$pid" 2>/dev/null
  waited=0
  while [ "$waited" -lt 20 ]; do
    [ -z "$(listener "$PORT")" ] && { echo "lane.sh: lane $1 stopped (was PID $pid); port $PORT is free"; return 0; }
    /bin/sleep 1; waited=$((waited + 1))
  done
  echo "lane.sh: lane $1 (PID $pid) still listens on $PORT after 20 s; it was sent TERM only" >&2
  exit 69
}

cmd_status() {
  for lane in main 1 2 3; do
    plan "$lane"
    pid=$(listener "$PORT")
    if [ -n "$pid" ]; then state="RUNNING (PID $pid)"; else state="stopped"; fi
    echo "lane $lane  port $PORT  $DATABASE  $MODE  demo controls $DEMO  $state"
    echo "          media store root $MEDIA"
  done
}

cmd_reset() {
  plan "$1"; check_root; say_plan "$1"; check_real_prerequisites
  pid=$(listener "$PORT")
  if [ -n "$pid" ]; then echo "lane.sh: the Core of lane $1 is running (PID $pid on $PORT): stop it first; nothing was reset" >&2; exit 69; fi
  lane_env
  mkdir -p "$LOCKS"
  # shellcheck disable=SC2086
  ( cd "$ROOT" && env $LANE_ENV /usr/bin/lockf -k "$LOCKS/db-migrate.lock" npm run -s db:reset -w @dems/core-server -- --database "$DATABASE" )
}

[ $# -ge 1 ] || usage
case "$1" in
  status) [ $# -eq 1 ] || usage; cmd_status ;;
  start)  [ $# -eq 2 ] || usage; cmd_start "$2" ;;
  stop)   [ $# -eq 2 ] || usage; cmd_stop "$2" ;;
  reset)  [ $# -eq 2 ] || usage; cmd_reset "$2" ;;
  *) usage ;;
esac
