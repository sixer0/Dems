#!/bin/sh
# W12 device commands. Runs inside apps/mobile/scripts/device-session.sh: the device lock is held,
# Metro is up, the reverse rules are set. $1 = run id, $2 = output folder.
set -u
RUN=$1
OUT=$2
A="adb -s $SERIAL"
echo "-- serial $SERIAL ($AVD_NAME), app $APP_ID, Metro port $METRO_PORT"
echo "-- adb reverse --list (start of commands):"
$A reverse --list
OWN=0
if ! $A reverse --list | grep -q "tcp:4420 tcp:4421"; then
  echo "-- device-session.sh did not set tcp:4420 -> tcp:4421; setting it here (removed at the end)"
  $A reverse tcp:4420 tcp:4421 && OWN=1
  $A reverse --list
fi
# The app's activity cannot start while the Android user is locked (PIN keyguard after a cold boot,
# README.md:141). This row does not type the PIN; it stops here and says so.
STATE=$($A shell dumpsys user 2>/dev/null | grep -m 1 "State:" | tr -d '\r' | sed 's/^ *//')
echo "-- Android user 0: $STATE"
case "$STATE" in
  *RUNNING_UNLOCKED*) ;;
  *)
    echo "-- $AVD_NAME is locked (keyguard). Unlock it first (README.md:141), then run this proof again."
    if [ "$OWN" = 1 ]; then $A reverse --remove tcp:4420; fi
    exit 69
    ;;
esac
echo "-- installed build:"
$A shell dumpsys package "$APP_ID" | grep -E "versionName|versionCode|lastUpdateTime|flags=" | head -5
T0=$($A shell "date '+%m-%d %H:%M:%S.000'" | tr -d '\r')
echo "-- device time at launch: $T0"
START=$($A shell "am start -W -a android.intent.action.VIEW -d 'demsdemo:///?probe=core-client&run=$RUN' $APP_ID" 2>&1)
echo "$START"
case "$START" in
  *Error*)
    echo "-- the app did not start; not waiting for probe lines"
    if [ "$OWN" = 1 ]; then $A reverse --remove tcp:4420; fi
    exit 69
    ;;
esac
i=0
until $A logcat -d -T "$T0" -s ReactNativeJS:V 2>/dev/null | grep -q "DEMS-PROBE-W12 run=$RUN\] DONE" || [ "$i" -ge 180 ]; do
  i=$((i + 1))
  sleep 2
done
echo "-- waited $((i * 2)) s for the DONE line"
echo "-- adb logcat -d -s ReactNativeJS:V | grep 'DEMS-PROBE-W12 run=$RUN':"
$A logcat -d -T "$T0" -s ReactNativeJS:V | grep "DEMS-PROBE-W12 run=$RUN" | tee "$OUT/logcat_probe.txt"
$A logcat -d -T "$T0" -s ReactNativeJS:V | tail -n 80 >"$OUT/logcat_reactnativejs_tail.txt"
$A exec-out screencap -p >"$OUT/screen_$AVD_NAME.png"
echo "-- Metro log (bundle and error lines):"
grep -E "Bundled|rror" "$METRO_LOG" | tail -n 20 | tee "$OUT/metro_tail.txt"
if [ "$OWN" = 1 ]; then
  $A reverse --remove tcp:4420
  echo "-- own rule tcp:4420 removed"
fi
echo "-- adb reverse --list (end of commands; device-session.sh removes its own rules after this):"
$A reverse --list
grep -q "DEMS-PROBE-W12 run=$RUN\] DONE" "$OUT/logcat_probe.txt"
