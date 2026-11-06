#!/bin/sh
# W13 follow-up: the launch check that could not run while the emulators were locked (13_npm_slot_n3_mobile_native.md, section 9).
# Session commands for apps/mobile/scripts/device-session.sh with a Metro lane. From the workspace root, outside the sandbox:
#
#   A=docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets
#   METRO_PORT=8085 DEVICE_SESSION_MAX_SECONDS=600 apps/mobile/scripts/device-session.sh phone  "/bin/sh '$PWD/$A/13_launch_check.sh'"
#   ... the same with tablet and phone2, one after the other.
#
# One launch and one screencap. It installs nothing, clears nothing and enters no PIN: if the emulator has not been
# unlocked since boot (the user's action, README.md:141) it stops with status 30. Optional: W13_CDP_PROBE=1.
set -u
ASSETS="$ROOT/docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets"
state=$(adb -s "$SERIAL" shell dumpsys user | grep -E "State: " | head -n 1 | sed 's/^ *//' | tr -d '\r')
echo "== $AVD_NAME $SERIAL $(date '+%H:%M:%S'); METRO_PORT=${METRO_PORT:-none}; user state: $state"
case "$state" in
  *RUNNING_UNLOCKED*) ;;
  *)
    echo "STOP: the emulator is not unlocked ($state). Unlock it first (README.md:141); this script enters no PIN."
    exit 30
    ;;
esac
[ -n "${METRO_PORT:-}" ] && [ "${NO_METRO:-0}" != 1 ] || { echo "STOP: this check needs a Metro lane (METRO_PORT=8081..8086)"; exit 64; }
adb -s "$SERIAL" shell dumpsys package "$APP_ID" | grep -E "versionCode|signatures=|firstInstallTime|lastUpdateTime" | sed 's/^ *//' | tr -d '\r'
bp=$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r' | sed -n 's/^package://p' | head -n 1)
echo "base.apk on the device: $(adb -s "$SERIAL" shell sha256sum "$bp" | tr -d '\r' | cut -d' ' -f1)"
echo "-- LAUNCH $(date '+%H:%M:%S')"
adb -s "$SERIAL" logcat -c
n0=$(grep -c "Android Bundled" "$METRO_LOG" 2>/dev/null); n0=${n0:-0}
adb -s "$SERIAL" shell "am start -W -a android.intent.action.VIEW -d 'demsdemo:///' $APP_ID" | tr -d '\r' | grep -E "Status|LaunchState|TotalTime|Error"
i=0
until [ "$(grep -c 'Android Bundled' "$METRO_LOG" 2>/dev/null)" -gt "$n0" ] 2>/dev/null || [ "$i" -ge 300 ]; do sleep 2; i=$((i + 2)); done
echo "-- bundle wait: ${i}s"
grep -E "Android Bundled|Bundling failed|SyntaxError|Unable to resolve" "$METRO_LOG" | tail -n 4 | cut -c1-220
sleep 12
pid=$(adb -s "$SERIAL" shell pidof "$APP_ID" | tr -d '\r')
echo "-- pidof after launch: [$pid]"
adb -s "$SERIAL" shell dumpsys window | grep -E "mCurrentFocus" | tr -d '\r' | sed 's/^ *//'
# Runtime proof of the native module is not part of the W13 verification; step 37 (W15) probes it.
# W13_CDP_PROBE=1 adds the read-only inspector check (it evaluates one expression, calls no SecureStore function).
[ "${W13_CDP_PROBE:-0}" = 1 ] && node "$ASSETS/13_cdp_probe.mjs" "$METRO_PORT"
adb -s "$SERIAL" exec-out screencap -p >"$ASSETS/13_${AVD_NAME}_launch.png"
ls -la "$ASSETS/13_${AVD_NAME}_launch.png"
echo "-- logcat of the app process: FATAL / JS error lines"
adb -s "$SERIAL" logcat -d ${pid:+--pid=$pid} 2>/dev/null | tr -d '\r' | grep -E "FATAL EXCEPTION|E ReactNativeJS|E AndroidRuntime|E unknown:ReactNative" | cut -c1-240 | head -n 12
echo "   (end of logcat filter)"
[ -n "$pid" ] || { echo "RESULT: the app is not running"; exit 31; }
echo "== $AVD_NAME end $(date '+%H:%M:%S')"
