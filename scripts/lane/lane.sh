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
#   scripts/lane/lane.sh seal-rig 2 <unsealable|blocked|release|status>
#                                              development capture lane only, started with
#                                              --with-camera-stub: make the NEXT seal of a session
#                                              that recorded from generated (FAKE) sources fail on
#                                              purpose (see "THE SEAL RIG" below)
#   scripts/lane/lane.sh source-rig 2 unreachable <CAM-NN|MIC-NN>
#   scripts/lane/lane.sh source-rig 2 <release|status>
#                                              development capture lane only, started with
#                                              --with-camera-stub: make a generated (FAKE) test
#                                              source answer as unreachable at the next pre-check
#                                              or session start (see "THE SOURCE RIG" below)
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
# THE SEAL RIG (fix wave K, decision D220; re-gate 75 "blocked seal not provable live"). A
# development tool of the lane launcher (apps/core-server/test/support/lane-seal-rig.ts): the
# product's own entry point cannot load it, the launcher does not start a production configuration
# with it (check sealing.sealRig, code DEV_SEAL_RIG_IN_PRODUCTION), and the sealing host refuses it
# outside REAL_DEVELOPMENT. It is there whenever lane 2 runs with --with-camera-stub, and it is
# OFF until its switch file ($LOCKS/seal-rig.lane2.switch) says otherwise:
#     scripts/lane/lane.sh seal-rig 2 unsealable   the seal of the NEXT session that ends fails with
#                                                  the product's cause SESSION_KEY_NOT_OF_SESSION
#                                                  (not retriable): three attempts by the product's
#                                                  own bounds (at once, +5 s, +30 s), then the
#                                                  session ends UNSEALABLE - recordings moved to
#                                                  .quarantine/, session INCOMPLETE, one CRITICAL
#                                                  alert, the Core free for a new session
#     scripts/lane/lane.sh seal-rig 2 blocked      the seal of the NEXT session that ends fails with
#                                                  the product's cause SESSION_KEY_STORE_UNAVAILABLE
#                                                  (retriable): retries at +5 s, +30 s, +120 s, then
#                                                  "sealing blocked" (CRITICAL) for as long as the
#                                                  switch is on
#     scripts/lane/lane.sh seal-rig 2 release      the switch is OFF. A blocked seal completes by the
#                                                  product's own retry: the next automatic retry if
#                                                  one is still due, else the recovery action of the
#                                                  session (web / tablet), else the next start
#     scripts/lane/lane.sh seal-rig 2 status       what the switch file says
# The rig binds itself to ONE session - the first whose seal it meets - and writes that session's ID
# into the switch file; no later session is touched until the switch is set again. A session that
# recorded from this computer's camera or microphone (LOCAL_DEVICE) or from a production source is
# never touched: the rig lets its seal through and says so in the Core's log. No key file is
# written, read or planted: the rig refuses before the sealer is called.
# After "unsealable" the lane holds a quarantine folder: the next reset of lane 2 needs
# --discard-unsealed-fake-recordings (see above). Always end with "release".
#
# THE SOURCE RIG (fix wave M, decision D232; final re-check 70 finding G70d-01: "notification B not
# provable live"). The test sources of the development lane are GENERATED on this machine: they
# dial nothing, so a registered FAKE camera on a dead address passes every pre-check. This
# development tool of the lane launcher (apps/core-server/test/support/lane-source-rig.ts) makes
# a generated source answer as a source that is not there, through its adapter's own doors. The
# product's entry point cannot load it, the launcher does not start a production configuration with
# it (check capture.sourceRig, code DEV_SOURCE_RIG_IN_PRODUCTION), and the capture fence refuses its
# switch outside REAL_DEVELOPMENT. It is there whenever lane 2 runs with --with-camera-stub, and it
# is OFF until its switch file ($LOCKS/source-rig.lane2.switch) says otherwise:
#     scripts/lane/lane.sh source-rig 2 unreachable CAM-05
#                                                  from the NEXT pre-check run on, CAM-05 does not
#                                                  answer: the product's own pre-check reports it
#                                                  (the device not online, its check row WARN or
#                                                  BLOCK by the start rule, ONE alert and ONE
#                                                  CAPTURE_DEVICE_UNREACHABLE row per occurrence),
#                                                  and a session start is refused that source. A
#                                                  second call with another device ADDS it (at most
#                                                  four: "both cameras unreachable" is two calls)
#     scripts/lane/lane.sh source-rig 2 release    the switch is OFF: every source answers again at
#                                                  the next pre-check run (the alert is resolved by
#                                                  that run, not by the release itself)
#     scripts/lane/lane.sh source-rig 2 status     what the switch file says
# Cameras AND microphones (MIC-NN) are accepted. GENERATED (FAKE) sources only: the switch is read
# by the generated adapters alone, so this computer's camera and microphone (LOCAL_DEVICE) and a
# production source are never touched - a switch that names one changes nothing for it and the
# Core says so in its log (LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE). The switch takes effect on the
# RUNNING lane (it is read at every reachability read and every open); it opens nothing, and it
# does not end a source that is already open (a running recording goes on). Always end with
# "release".
#
# Exit codes: 0 done; 64 usage or unknown lane; 69 the lane is in the wrong state (already
# running, not running, a prerequisite of lane 2 is missing); 70 the Core did not become ready.

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P) || exit 70
LOCKS="$ROOT/.locks"
READY_SECONDS=${LANE_READY_SECONDS:-40}

usage() {
  echo "usage: $0 start <main|1|2|3> [--with-camera-stub] [--speech-mic]   |   $0 stop|reset <main|1|2|3>   |   $0 reset 2 --discard-unsealed-fake-recordings   |   $0 seal-rig 2 <unsealable|blocked|release|status>   |   $0 source-rig 2 unreachable <CAM-NN|MIC-NN>   |   $0 source-rig 2 <release|status>   |   $0 status" >&2
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

# What the source rig's switch file says, in one line (see "THE SOURCE RIG" above). No file: OFF.
source_rig_state() {
  if [ -r "$1" ]; then state=$(head -n 1 "$1" | tr -d '\r'); echo "${state:-OFF}"; else echo "OFF"; fi
}

say_source_rig() {
  echo "lane.sh: source rig available (development tool): switch $SOURCE_RIG says: $(source_rig_state "$SOURCE_RIG")"
  [ "$(source_rig_state "$SOURCE_RIG")" = OFF ] || echo "lane.sh: THE SOURCE RIG IS ON: a generated test source of this lane answers as unreachable on purpose. '$0 source-rig $1 release' switches it off."
}

cmd_source_rig() {
  plan "$1"
  if [ "$MODE" != REAL_DEVELOPMENT ]; then
    echo "lane.sh: the source rig is for the development capture lane only; lane $1 runs $MODE. Nothing was changed." >&2; exit 64
  fi
  SOURCE_RIG="$LOCKS/source-rig.lane$1.switch"
  mkdir -p "$LOCKS"
  case "$2" in
    status)  [ -z "$3" ] || usage ;;
    release) [ -z "$3" ] || usage; ( umask 077 && echo OFF >"$SOURCE_RIG" ) ;;
    unreachable)
      # A registry ID of a camera or a microphone, nothing else: the word goes into a file the Core reads.
      case "$3" in
        CAM-[0-9][0-9]|MIC-[0-9][0-9]) ;;
        *) echo "lane.sh: source-rig unreachable needs the registry ID of a generated test source (CAM-NN or MIC-NN). Nothing was changed." >&2; exit 64 ;;
      esac
      now=$(source_rig_state "$SOURCE_RIG")
      case "$now" in
        "UNREACHABLE "*) case " ${now#UNREACHABLE } " in *" $3 "*) next=$now ;; *) next="$now $3" ;; esac ;;
        *) next="UNREACHABLE $3" ;;
      esac
      # shellcheck disable=SC2086 -- the words of the switch are counted
      if [ "$(echo $next | wc -w)" -gt 5 ]; then
        echo "lane.sh: the source rig names four devices already ($now). '$0 source-rig $1 release' first. Nothing was changed." >&2; exit 64
      fi
      ( umask 077 && echo "$next" >"$SOURCE_RIG" ) ;;
    *) usage ;;
  esac
  echo "lane.sh: source rig of lane $1: $(source_rig_state "$SOURCE_RIG")   (switch file $SOURCE_RIG)"
  [ "$2" = unreachable ] && echo "lane.sh: only a GENERATED (FAKE) test source is switched; any other device is left alone and the Core's log says so (LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE). It takes effect at the next pre-check run or session start."
  pid=$(listener "$PORT")
  if [ -z "$pid" ]; then
    echo "lane.sh: lane $1 is not running: the switch is read by a Core started with '$0 start $1 --with-camera-stub'."
  elif [ ! -r "$LOCKS/camera-stub.lane$1.fixture" ]; then
    echo "lane.sh: lane $1 runs WITHOUT the lane launcher (no --with-camera-stub): this Core has no source rig and does not read the switch." >&2
    exit 69
  fi
}

# What the seal rig's switch file says, in one line (see "THE SEAL RIG" above). No file: OFF.
seal_rig_state() {
  if [ -r "$1" ]; then state=$(head -n 1 "$1" | tr -d '\r'); echo "${state:-OFF}"; else echo "OFF"; fi
}

say_seal_rig() {
  echo "lane.sh: seal rig available (development tool): switch $SEAL_RIG says: $(seal_rig_state "$SEAL_RIG")"
  [ "$(seal_rig_state "$SEAL_RIG")" = OFF ] || echo "lane.sh: THE SEAL RIG IS ON: a seal on this lane is made to fail on purpose. '$0 seal-rig $1 release' switches it off."
}

cmd_seal_rig() {
  plan "$1"
  if [ "$MODE" != REAL_DEVELOPMENT ]; then
    echo "lane.sh: the seal rig is for the development capture lane only; lane $1 runs $MODE. Nothing was changed." >&2; exit 64
  fi
  SEAL_RIG="$LOCKS/seal-rig.lane$1.switch"
  mkdir -p "$LOCKS"
  case "$2" in
    status) ;;
    unsealable) ( umask 077 && echo UNSEALABLE >"$SEAL_RIG" ) ;;
    blocked)    ( umask 077 && echo BLOCKED >"$SEAL_RIG" ) ;;
    release)    ( umask 077 && echo OFF >"$SEAL_RIG" ) ;;
    *) usage ;;
  esac
  echo "lane.sh: seal rig of lane $1: $(seal_rig_state "$SEAL_RIG")   (switch file $SEAL_RIG)"
  pid=$(listener "$PORT")
  if [ -z "$pid" ]; then
    echo "lane.sh: lane $1 is not running: the switch is read by a Core started with '$0 start $1 --with-camera-stub'."
  elif [ ! -r "$LOCKS/camera-stub.lane$1.fixture" ]; then
    echo "lane.sh: lane $1 runs WITHOUT the lane launcher (no --with-camera-stub): this Core has no seal rig and does not read the switch." >&2
    exit 69
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
  SEAL_RIG="$LOCKS/seal-rig.lane$1.switch"
  SOURCE_RIG="$LOCKS/source-rig.lane$1.switch"
  pid=$(listener "$PORT")
  if [ -n "$pid" ]; then echo "lane.sh: port $PORT already has a listener (PID $pid): not started" >&2; exit 69; fi
  lane_env
  mkdir -p "$LOCKS"
  mkdir -p "$MEDIA" && chmod 700 "$MEDIA"  # fix F-M7b: the lane's own media store root (.data/media/<database>/sessions), owner-only; a real-mode Core refuses any other mode (READABLE_BY_OTHERS)
  if [ "$2" = --with-camera-stub ]; then
    # The lane launcher of the test support: the same Core, with the fake ONVIF camera on loopback as its camera search.
    # shellcheck disable=SC2086 -- LANE_ENV is a list of blank-free words by check_root
    ( cd "$ROOT" && nohup env $LANE_ENV "DEMS_CORE_PORT=$PORT" npm run -s start:camera-stub -w @dems/core-server -- --fixture-file "$STUB_FIXTURE" --mode-file "$STUB_MODE" --seal-rig-file "$SEAL_RIG" --source-rig-file "$SOURCE_RIG" >"$LOG" 2>&1 & )
  else
    # shellcheck disable=SC2086 -- LANE_ENV is a list of blank-free words by check_root
    ( cd "$ROOT" && nohup env $LANE_ENV "DEMS_CORE_PORT=$PORT" npm run -s start:server >"$LOG" 2>&1 & )
  fi
  waited=0
  while [ "$waited" -lt "$READY_SECONDS" ]; do
    if curl -s -m 2 "http://127.0.0.1:$PORT/api/v1/health" 2>/dev/null | grep -q '"ready":{"database":true,"engine":true}'; then
      echo "lane.sh: lane $1 is ready on 127.0.0.1:$PORT (PID $(listener "$PORT")); log $LOG"
      [ "$2" = --with-camera-stub ] && say_camera_stub "$1"
      [ "$2" = --with-camera-stub ] && [ "$MODE" = REAL_DEVELOPMENT ] && say_seal_rig "$1"
      [ "$2" = --with-camera-stub ] && [ "$MODE" = REAL_DEVELOPMENT ] && say_source_rig "$1"
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
  seal-rig) [ $# -eq 3 ] || usage; cmd_seal_rig "$2" "$3" ;;
  source-rig) [ $# -eq 3 ] || [ $# -eq 4 ] || usage; cmd_source_rig "$2" "$3" "${4:-}" ;;
  reset)
    [ $# -eq 2 ] || { [ $# -eq 3 ] && [ "$3" = "--discard-unsealed-fake-recordings" ]; } || usage
    cmd_reset "$2" "${3:-}" ;;
  *) usage ;;
esac
