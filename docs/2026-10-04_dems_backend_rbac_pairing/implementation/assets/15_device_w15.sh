#!/bin/sh
# W15 device commands (early proof g: the secure-store probe). Runs INSIDE
# apps/mobile/scripts/device-session.sh: the device lock is held, Metro is up, the session's reverse
# rules are set. $1 = run id, $2 = output folder, $3 = probe name (secure-store | secure-store-wait).
#
# Everything here is a query, a launch of the app by its deep link, or a screencap. It types
# nothing, presses nothing, sets no lock, PIN, fingerprint or device setting, sends no fingerprint
# touch and sets no reverse rule (D35, D49, D60). If the OS shows a prompt, it is photographed and
# left alone; the session's cleanup force-stops the app, which closes it.
set -u
RUN=$1
OUT=$2
PROBE=${3:-secure-store}
A="adb -s $SERIAL"
TAG="DEMS-PROBE-W15 run=$RUN"
echo "-- serial $SERIAL ($AVD_NAME), app $APP_ID, Metro port $METRO_PORT, probe $PROBE, run $RUN"
echo "-- adb reverse --list (start of commands):"
$A reverse --list

# Read-only: the lock state of the device. Nothing is written by any of these four queries.
lock_state() {
  echo "-- lock state ($1; read-only queries):"
  echo "   $($A shell dumpsys window 2>/dev/null | tr -d '\r' | grep -o 'isKeyguardShowing=[a-z]*' | head -n 1)"
  echo "   user 0: $($A shell dumpsys user 2>/dev/null | tr -d '\r' | grep -m 1 'State:' | sed 's/^ *//')"
  echo "   $($A shell dumpsys lock_settings 2>/dev/null | tr -d '\r' | grep -m 1 'CredentialType' | sed 's/^ *//')"
  echo "   fingerprints enrolled: $($A shell dumpsys fingerprint 2>/dev/null | tr -d '\r' | grep -o '"count":[0-9]*' | head -n 1)"
}
lock_state "start of the session" | tee "$OUT/lock_state_start.txt"
if grep -q '"count":0' "$OUT/lock_state_start.txt" || ! grep -q '"count":' "$OUT/lock_state_start.txt"; then
  ENROLMENT="without enrolment"
else
  ENROLMENT="with enrolment"
fi
echo "-- every observation of this session is: $ENROLMENT" | tee "$OUT/enrolment.txt"

STATE=$($A shell dumpsys user 2>/dev/null | grep -m 1 "State:" | tr -d '\r' | sed 's/^ *//')
case "$STATE" in
  *RUNNING_UNLOCKED*) ;;
  *)
    echo "-- $AVD_NAME is locked ($STATE). The device part stops here; the user unlocks the device."
    exit 77
    ;;
esac

# What the app has stored: names and sizes only, never a value.
app_data() {
  echo "-- app data ($1): files of shared_prefs and databases; AsyncStorage keys with the length of each value; names of the secure-store entries"
  $A shell "run-as $APP_ID sh -c 'ls -l shared_prefs databases 2>&1'" | tr -d '\r' | sed 's/^/   /'
  $A shell "run-as $APP_ID sh -c 'sqlite3 databases/RKStorage \"select key, length(value) from catalystLocalStorage order by key\" 2>&1'" | tr -d '\r' | sed 's/^/   key: /'
  echo "   secure-store entries (entry names of shared_prefs/SecureStore.xml, read on the device; none listed = none stored):"
  $A shell "run-as $APP_ID sh -c 'grep -o \"name=[^ >]*\" shared_prefs/SecureStore.xml 2>&1'" | tr -d '\r' | sed 's/^/   entry: /'
}
app_data "before the launch" | tee "$OUT/app_data_before.txt"
echo "-- installed build:"
$A shell dumpsys package "$APP_ID" | grep -E "versionName|versionCode|lastUpdateTime" | head -4

T0=$($A shell "date '+%m-%d %H:%M:%S.000'" | tr -d '\r')
echo "-- device time at launch: $T0"
START=$($A shell "am start -W -a android.intent.action.VIEW -d 'demsdemo:///?probe=$PROBE&run=$RUN' $APP_ID" 2>&1)
echo "$START"
case "$START" in
  *Error*)
    echo "-- the app did not start; not waiting for probe lines"
    exit 69
    ;;
esac

# Wait for the DONE line. Meanwhile: which window has the focus (a query), each change logged; a
# window that is neither the app nor the launcher is photographed once per change and left alone.
case "$PROBE" in secure-store-wait) MAX=560 ;; *) MAX=200 ;; esac
i=0
LAST=""
SHOTS_TAKEN=0
: >"$OUT/focus_timeline.txt"
while :; do
  FOCUS=$($A shell dumpsys window 2>/dev/null | tr -d '\r' | grep -m 1 'mCurrentFocus' | sed 's/^ *//')
  if [ "$FOCUS" != "$LAST" ]; then
    echo "$(date '+%H:%M:%S') $FOCUS" | tee -a "$OUT/focus_timeline.txt"
    LAST=$FOCUS
    case "$FOCUS" in
      *"$APP_ID"* | *nexuslauncher* | *"mCurrentFocus=null"* | "") ;;
      *)
        SHOTS_TAKEN=$((SHOTS_TAKEN + 1))
        $A exec-out screencap -p >"$OUT/other_window_${SHOTS_TAKEN}_$AVD_NAME.png"
        echo "   another window has the focus: screencap other_window_${SHOTS_TAKEN}_$AVD_NAME.png (nothing is pressed)" | tee -a "$OUT/focus_timeline.txt"
        ;;
    esac
  fi
  if $A logcat -d -T "$T0" -s ReactNativeJS:V 2>/dev/null | grep -q "$TAG\] DONE"; then break; fi
  i=$((i + 1))
  [ "$i" -ge "$MAX" ] && break
  sleep 0.5
done
echo "-- waited $i polls for the DONE line; windows other than the app or the launcher seen: $SHOTS_TAKEN"
$A exec-out screencap -p >"$OUT/screen_$AVD_NAME.png"
echo "-- screencap at the end of the probe: screen_$AVD_NAME.png; focus now: $($A shell dumpsys window 2>/dev/null | tr -d '\r' | grep -m 1 'mCurrentFocus' | sed 's/^ *//')"
echo "-- adb logcat -d -s ReactNativeJS:V | grep '$TAG':"
$A logcat -d -T "$T0" -s ReactNativeJS:V | grep "$TAG" | tee "$OUT/logcat_probe.txt"
$A logcat -d -T "$T0" -s ReactNativeJS:V | tail -n 60 >"$OUT/logcat_reactnativejs_tail.txt"
# A second screencap once the opening animation is over: which screen the app shows after the probe.
sleep 7
$A exec-out screencap -p >"$OUT/screen_settled_$AVD_NAME.png"
echo "-- screencap 7 s later: screen_settled_$AVD_NAME.png; focus now: $($A shell dumpsys window 2>/dev/null | tr -d '\r' | grep -m 1 'mCurrentFocus' | sed 's/^ *//')"
app_data "after the probe" | tee "$OUT/app_data_after.txt"
echo "-- the Core link source the app has stored (absent = the default, Simulated):"
$A shell "run-as $APP_ID sh -c 'sqlite3 databases/RKStorage \"select value from catalystLocalStorage where key = \\\"dems.mobile.prefs.v1\\\"\" 2>&1'" | tr -d '\r' | sed 's/^/   /' | tee "$OUT/app_prefs_after.txt"
echo "-- Metro log (bundle and error lines):"
grep -E "Bundled|rror" "$METRO_LOG" | tail -n 12 | tee "$OUT/metro_tail.txt"
lock_state "end of the commands" | tee "$OUT/lock_state_end.txt"
echo "-- adb reverse --list (end of commands; device-session.sh removes its own rules after this):"
$A reverse --list
grep -q "$TAG\] DONE" "$OUT/logcat_probe.txt"
