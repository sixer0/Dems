#!/bin/sh
# W15 (early proof g): the secure-store probe on the debug-build emulators, one device session each,
# one after the other. ONE command, from any directory, OUTSIDE the sandbox (adb, Metro's port):
#
#   /bin/sh docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/15_run_w15.sh                # phone, tablet, phone2
#   /bin/sh docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/15_run_w15.sh phone tablet   # the re-probe of two devices
#   W15_WAIT=1 /bin/sh docs/.../assets/15_run_w15.sh phone      # waits 60 s per protected step, for a
#                                                              # run in which the USER answers the OS prompts
#
# Needs no Core server and sets no tcp:4420 rule. Metro: 8082 (phone), 8083 (tablet), 8084 (phone2).
# Output: implementation/assets/15_runs/<target>-<run id>/ (session.log, logcat_probe.txt, the lock
# state at the start and at the end, focus_timeline.txt, app data before and after, screencaps).
# It never unlocks a device and never answers an OS prompt; see 15_device_w15.sh.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../../.." && pwd)
PROBE=secure-store
[ "${W15_WAIT:-0}" = 1 ] && PROBE=secure-store-wait
[ "$#" -gt 0 ] || set -- phone tablet phone2
STATUS=0
for T in "$@"; do
  case "$T" in
    phone) MP=8082 ;;
    tablet) MP=8083 ;;
    phone2) MP=8084 ;;
    *)
      echo "unknown target $T (phone | tablet | phone2)" >&2
      exit 64
      ;;
  esac
  RUN="w15x$(date +%H%M%S)"
  OUT="$HERE/15_runs/$T-$RUN"
  mkdir -p "$OUT"
  echo "== $(date '+%H:%M:%S') target $T, run $RUN, probe $PROBE, Metro $MP"
  {
    METRO_PORT=$MP DEVICE_SESSION_MAX_SECONDS=600 LOCK_WAIT=${LOCK_WAIT:-900} \
      "$ROOT/apps/mobile/scripts/device-session.sh" "$T" "/bin/sh '$HERE/15_device_w15.sh' '$RUN' '$OUT' '$PROBE'"
    echo "$?" >"$OUT/session_exit.txt"
  } 2>&1 | tee "$OUT/session.log"
  CODE=$(cat "$OUT/session_exit.txt" 2>/dev/null || echo "?")
  echo "== $(date '+%H:%M:%S') target $T: device session exit=$CODE (77: the device shows a secure lock; 69: device unavailable or a foreign emulator on its port)"
  [ "$CODE" = 0 ] || STATUS=1
done
exit "$STATUS"
