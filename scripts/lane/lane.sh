#!/bin/sh
# DEMS Core lanes: ONE place for the start, stop, status and reset of the main instance and the
# three lane instances (task 3, decisions D171 / D174 / D175; plan in
# docs/2026-10-07_dems_real_capture_sealing/initialization/04_gate_environment_wave_f.md).
#
#   scripts/lane/lane.sh start  <main|1|2|3>   start that Core detached, wait until it is ready
#   scripts/lane/lane.sh start  <lane> --with-camera-stub
#                                              the same Core, started by the lane launcher of the
#                                              test support with ONE fake ONVIF camera on loopback
#                                              as its camera search (see "THE CAMERA STUB" below)
#   scripts/lane/lane.sh start  2 --speech-mic   lane 2 only (development capture): the first test
#                                              microphone plays the speech fixture (ruling D198);
#                                              the two options may be given together
#   scripts/lane/lane.sh stop   <main|1|2|3>   stop that Core (TERM to the listener of its port)
#   scripts/lane/lane.sh status                what listens on 4420-4423, and the plan of each
#   scripts/lane/lane.sh reset  <main|1|2|3>   db:reset of that database, under the migrate lock
#   scripts/lane/lane.sh reset  2 --discard-unsealed-fake-recordings
#                                              development capture lane only: the same reset, and it
#                                              may erase UNSEALED recording folders of sessions that
#                                              recorded from generated (FAKE) sources only (see
#                                              "A LANE WHOSE SEAL FAILED" below)
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
# touches no port outside 4420-4423 and stops only the listener of the lane it was asked for
# (the camera stub of "--with-camera-stub" binds three ephemeral ports of 127.0.0.1 inside the
# Core's own process and goes with it).
# Web dev servers, Metro and the device rules are not started here (see the note above, section 7).
#
# THE CAMERA STUB (fix wave H, gate 70 finding B-1, decision D196). "--with-camera-stub" starts
# the lane's Core through "npm run start:camera-stub -w @dems/core-server"
# (apps/core-server/test/support/lane-camera-stub-cli.ts) in the place of "npm run start:server".
# It is the same Core with one addition: every camera search of that Core goes to ONE fake ONVIF
# device on 127.0.0.1 (three ephemeral ports) and to nothing else - no multicast, no datagram to
# the real network. The capture fence decides: a development lane (REAL_DEVELOPMENT) gets the
# stub; a SIMULATED lane starts WITHOUT it and says so; a production configuration is not started
# at all (check capture.cameraStub, code DEV_CAMERA_STUB_IN_PRODUCTION). The product's own entry
# point cannot load the stub, with any flag. The stub's fixture account is made at each start and
# printed below once the lane is ready: it is a fixture of the fake device, not a secret, and it
# opens nothing else. What the stub answers is switched by ONE word in its mode file (printed
# too): NORMAL, AUTH_SCHEME, UNREACHABLE, NO_PROFILE, NOT_H264, EMPTY.
#
# A LANE WHOSE SEAL FAILED (fix wave I, re-gate 75 finding G75b-01, decision D216). A reset is
# refused (RESET_BLOCKED_REAL_EVIDENCE) while the media store holds a recording that is not a
# sealed, provable development package: the folder of a session whose seal did not complete
# (SESSION-<id> without a manifest) and a folder the Core moved to .quarantine/. That guard is
# right for evidence and it made a development lane unusable for ever after one failed seal.
# The documented way out, for the development capture lane ONLY:
#     scripts/lane/lane.sh stop 2
#     scripts/lane/lane.sh reset 2 --discard-unsealed-fake-recordings
# With the option the reset erases such a folder when - and only when - the database being reset
# says its session recorded from exactly four generated (FAKE) sources and has no sealed item.
# A recording from this computer's camera or microphone (LOCAL_DEVICE) or from a production
# device is never erased this way: it still blocks, and a person decides about it. The refusal
# of a reset without the option says how many folders the option would clear. The reset also
# destroys EVERY session key of the lane's key folder (the demo packages it seals anew keep
# theirs): after it no key of an earlier session can meet a session number given out again.
#
# Exit codes: 0 done; 64 usage or unknown lane; 69 the lane is in the wrong state (already
# running, not running, a prerequisite of lane 2 is missing); 70 the Core did not become ready.

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P) || exit 70
LOCKS="$ROOT/.locks"
READY_SECONDS=${LANE_READY_SECONDS:-40}

usage() {
  echo "usage: $0 start <main|1|2|3> [--with-camera-stub] [--speech-mic]   |   $0 stop|reset <main|1|2|3>   |   $0 reset 2 --discard-unsealed-fake-recordings   |   $0 status" >&2
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
  OPTIONS=""
  [ "${START_STUB:-}" = --with-camera-stub ] && OPTIONS="$OPTIONS --with-camera-stub"
  [ "${SPEECH_MIC:-}" = --speech-mic ] && OPTIONS="$OPTIONS --speech-mic"
  echo "lane.sh: lane $1 = port $PORT, database $DATABASE, capture operation $MODE, demo controls $DEMO, options:${OPTIONS:- none}"
  echo "lane.sh: media store root $MEDIA"
  if [ "$MODE" = REAL_DEVELOPMENT ]; then
    echo "lane.sh: lane 2 records from the FAKE (generated) sources: its selector is CAM-01, CAM-02, MIC-01, MIC-02. A selector naming this Mac's camera or microphone (LOCAL_DEVICE) is the user's own run, never an agent's."
  fi
}

# The environment of a lane, for "env": the variables of the plan and nothing else of the capture
# family (a value inherited from the caller's shell must not change the plan).
lane_env() {
  set -- -u DEMS_CAPTURE_MODE -u DEMS_CAPTURE_DEV_SOURCES -u DEMS_CAPTURE_HELPER_FFMPEG -u DEMS_CAPTURE_WORKER -u DEMS_CAPTURE_DEV_FAKE_MIC \
    -u DEMS_DEMO_CONTROLS -u DEMS_CORE_PORT -u DEMS_LOCAL_SESSION_ATTENDED -u DEMS_USER_ATTENDED \
    "DEMS_MEDIA_DIR=$MEDIA"
  if [ "$MODE" = REAL_DEVELOPMENT ]; then
    set -- "$@" DEMS_CAPTURE_MODE=real DEMS_CAPTURE_DEV_SOURCES=1 "DEMS_CAPTURE_HELPER_FFMPEG=$HELPER" "DEMS_CAPTURE_WORKER=$WORKER"
    # --speech-mic (wave H, ruling D198; request of driver E): the first test microphone plays the speech fixture.
    [ "${SPEECH_MIC:-}" = --speech-mic ] && set -- "$@" DEMS_CAPTURE_DEV_FAKE_MIC=speech
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

# What a lane started with the camera stub tells the person or the gate that drives it. The
# fixture file exists only while a stub runs: the launcher writes it when the fence admitted the
# stub and removes it at its stop.
say_camera_stub() {
  if [ -r "$STUB_FIXTURE" ]; then
    echo "lane.sh: camera stub ON: ONE fake ONVIF camera on 127.0.0.1. Every camera search of lane $1 goes to it and to nothing else (no network search on this lane)."
    echo "lane.sh: its fixture account (a fixture of the fake device, not a secret; made at this start):"
    sed 's/^/lane.sh:   /' "$STUB_FIXTURE"
    echo "lane.sh: what it answers, one word:  echo <PRESET> > $STUB_MODE"
    echo "lane.sh:   NORMAL       the fixture account -> the camera can be reached; any other account -> the camera refused it"
    echo "lane.sh:   AUTH_SCHEME  the camera accepts only a sign-in the Core does not answer (SCHEME_NOT_ALLOWED; nothing is sent)"
    echo "lane.sh:   UNREACHABLE  the camera does not answer     NO_PROFILE  no usable profile     NOT_H264  H.265 only"
    echo "lane.sh:   EMPTY        no device answers a search (the empty-search notice)"
    echo "lane.sh: two refused accounts hold further tests of 127.0.0.1 for 30 minutes (the Core's lock-out guard); a reachable test or a restart of the lane clears it."
  else
    echo "lane.sh: camera stub IGNORED: lane $1 runs $MODE, which has no camera search with a stub. The Core runs as it does without the option (its log says LANE_CAMERA_STUB_IGNORED)."
  fi
}

cmd_start() {
  plan "$1"; check_root
  if [ "${SPEECH_MIC:-}" = --speech-mic ] && [ "$MODE" != REAL_DEVELOPMENT ]; then
    echo "lane.sh: --speech-mic is for the development-capture lane only (lane 2); lane $1 runs $MODE" >&2; exit 64
  fi
  say_plan "$1"; check_real_prerequisites
  [ "${SPEECH_MIC:-}" = --speech-mic ] && echo "lane.sh: the first test microphone plays the speech fixture: synthetic speech made by 'npm run capture:dev-setup'."
  STUB_FIXTURE="$LOCKS/camera-stub.lane$1.fixture"; STUB_MODE="$LOCKS/camera-stub.lane$1.mode"
  pid=$(listener "$PORT")
  if [ -n "$pid" ]; then echo "lane.sh: port $PORT already has a listener (PID $pid): not started" >&2; exit 69; fi
  lane_env
  mkdir -p "$LOCKS"
  mkdir -p "$MEDIA" && chmod 700 "$MEDIA"  # fix F-M7b: the lane's own media store root (.data/media/<database>/sessions), owner-only; a real-mode Core refuses any other mode (READABLE_BY_OTHERS)
  if [ "$2" = --with-camera-stub ]; then
    # The lane launcher of the test support: the same Core, with the fake ONVIF camera on loopback as its camera search.
    # shellcheck disable=SC2086 -- LANE_ENV is a list of blank-free words by check_root
    ( cd "$ROOT" && nohup env $LANE_ENV "DEMS_CORE_PORT=$PORT" npm run -s start:camera-stub -w @dems/core-server -- --fixture-file "$STUB_FIXTURE" --mode-file "$STUB_MODE" >"$LOG" 2>&1 & )
  else
    # shellcheck disable=SC2086 -- LANE_ENV is a list of blank-free words by check_root
    ( cd "$ROOT" && nohup env $LANE_ENV "DEMS_CORE_PORT=$PORT" npm run -s start:server >"$LOG" 2>&1 & )
  fi
  waited=0
  while [ "$waited" -lt "$READY_SECONDS" ]; do
    if curl -s -m 2 "http://127.0.0.1:$PORT/api/v1/health" 2>/dev/null | grep -q '"ready":{"database":true,"engine":true}'; then
      echo "lane.sh: lane $1 is ready on 127.0.0.1:$PORT (PID $(listener "$PORT")); log $LOG"
      [ "$2" = --with-camera-stub ] && say_camera_stub "$1"
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
  plan "$1"
  # The explicit word of the reset guard's rule (15): a development capture lane only (see "A LANE WHOSE SEAL FAILED").
  DISCARD=${2:-}
  if [ -n "$DISCARD" ] && [ "$MODE" != "REAL_DEVELOPMENT" ]; then
    echo "lane.sh: --discard-unsealed-fake-recordings is for the development capture lane only; lane $1 runs $MODE. Nothing was reset." >&2
    exit 64
  fi
  check_root; say_plan "$1"; check_real_prerequisites
  pid=$(listener "$PORT")
  if [ -n "$pid" ]; then echo "lane.sh: the Core of lane $1 is running (PID $pid on $PORT): stop it first; nothing was reset" >&2; exit 69; fi
  lane_env
  mkdir -p "$LOCKS"
  # shellcheck disable=SC2086
  ( cd "$ROOT" && env $LANE_ENV /usr/bin/lockf -k "$LOCKS/db-migrate.lock" npm run -s db:reset -w @dems/core-server -- --database "$DATABASE" $DISCARD )
}

[ $# -ge 1 ] || usage
case "$1" in
  status) [ $# -eq 1 ] || usage; cmd_status ;;
  start)
    [ $# -ge 2 ] || usage
    START_LANE=$2; START_STUB=""; SPEECH_MIC=""
    shift 2
    # The two options of start, each at most once, in any order; anything else is a usage error.
    for option in "$@"; do
      case "$option" in
        --with-camera-stub) [ -z "$START_STUB" ] || usage; START_STUB=$option ;;
        --speech-mic)       [ -z "$SPEECH_MIC" ] || usage; SPEECH_MIC=$option ;;
        *) usage ;;
      esac
    done
    cmd_start "$START_LANE" "$START_STUB" ;;
  stop)   [ $# -eq 2 ] || usage; cmd_stop "$2" ;;
  reset)
    [ $# -eq 2 ] || { [ $# -eq 3 ] && [ "$3" = "--discard-unsealed-fake-recordings" ]; } || usage
    cmd_reset "$2" "${3:-}" ;;
  *) usage ;;
esac
