#!/bin/sh
# W51 device commands: the app in LIVE mode against the lane backend. Runs INSIDE
# apps/mobile/scripts/device-session.sh: the device lock is held, Metro is up, the session's reverse
# rules are set (device tcp:4420 -> host tcp:4421). $1 = run id, $2 = output folder.
#
# Everything here is a query, a launch of the app by a deep link, a force-stop of the app, or a
# screencap. It types nothing, presses nothing, sets no lock, PIN, fingerprint or device setting,
# and sets no reverse rule (D35, D49, D60). The device is NOT paired here: no pairing code exists
# in this check.
set -u
RUN=$1
OUT=$2
A="adb -s $SERIAL"
echo "-- serial $SERIAL ($AVD_NAME), app $APP_ID, Metro port $METRO_PORT, run $RUN"
echo "-- adb reverse --list (start of commands):"
$A reverse --list

lock_state() {
  echo "-- lock state ($1; read-only queries):"
  echo "   $($A shell dumpsys window 2>/dev/null | tr -d '\r' | grep -o 'isKeyguardShowing=[a-z]*' | head -n 1)"
  echo "   user 0: $($A shell dumpsys user 2>/dev/null | tr -d '\r' | grep -m 1 'State:' | sed 's/^ *//')"
  echo "   $($A shell dumpsys lock_settings 2>/dev/null | tr -d '\r' | grep -m 1 'CredentialType' | sed 's/^ *//')"
  echo "   fingerprints enrolled: $($A shell dumpsys fingerprint 2>/dev/null | tr -d '\r' | grep -o '"count":[0-9]*' | head -n 1)"
}
lock_state "start of the session" | tee "$OUT/lock_state_start.txt"
STATE=$($A shell dumpsys user 2>/dev/null | grep -m 1 "State:" | tr -d '\r' | sed 's/^ *//')
case "$STATE" in
  *RUNNING_UNLOCKED*) ;;
  *)
    echo "-- $AVD_NAME is locked ($STATE). The device part stops here; the user unlocks the device."
    exit 77
    ;;
esac

# What the app has stored: names and sizes only, and the one preference value this check changes.
app_data() {
  echo "-- app data ($1): AsyncStorage keys with the length of each value; names of the secure-store entries"
  $A shell "run-as $APP_ID sh -c 'sqlite3 databases/RKStorage \"select key, length(value) from catalystLocalStorage order by key\" 2>&1'" | tr -d '\r' | sed 's/^/   key: /'
  echo "   secure-store entries (entry names of shared_prefs/SecureStore.xml; none listed = none stored):"
  $A shell "run-as $APP_ID sh -c 'grep -o \"name=[^ >]*\" shared_prefs/SecureStore.xml 2>&1'" | tr -d '\r' | sed 's/^/   entry: /'
}
prefs() {
  printf '%s' "-- dems.mobile.prefs.v1 ($1; absent = the default source, SIMULATED): "
  $A shell "run-as $APP_ID sh -c 'sqlite3 databases/RKStorage \"select value from catalystLocalStorage where key = \\\"dems.mobile.prefs.v1\\\"\" 2>&1'" | tr -d '\r'
  echo
}
app_data "before the first launch" | tee "$OUT/app_data_before.txt"
prefs "before the first launch" | tee "$OUT/prefs_before.txt"
echo "-- installed build:"
$A shell dumpsys package "$APP_ID" | grep -E "versionName|versionCode|lastUpdateTime" | head -3

T0=$($A shell "date '+%m-%d %H:%M:%S.000'" | tr -d '\r')
echo "-- device time at the first launch: $T0"
js() { $A logcat -d -T "$T0" -s ReactNativeJS:V 2>/dev/null; }
# Waits until the device log holds a line with $1 (at most $2 seconds). The exit status says whether it came.
wait_for() {
  i=0
  until js | grep -q -- "$1" || [ "$i" -ge "$2" ]; do
    i=$((i + 1))
    sleep 1
  done
  echo "-- waited $i s for: $1"
  js | grep -q -- "$1"
}
launch() {
  echo "-- am start -W -a android.intent.action.VIEW -d '$1' $APP_ID"
  $A shell "am start -W -a android.intent.action.VIEW -d '$1' $APP_ID" 2>&1 | tr -d '\r' | grep -E "Status|LaunchState|Activity|Error|TotalTime" | sed 's/^/   /'
}
focus() { $A shell dumpsys window 2>/dev/null | tr -d '\r' | grep -m 1 'mCurrentFocus' | sed 's/^ *//'; }

echo
echo "== A. cold start in LIVE mode on the Pair screen: demsdemo:///pair?core=LIVE"
launch 'demsdemo:///pair?core=LIVE'
wait_for 'runtime.live.ready' 150 || echo "-- the Live source did not report ready"
wait_for 'DEMS-LIVE\] GET /api/v1/auth/session' 30 || echo "-- no session probe line"
sleep 6
echo "-- focus: $(focus)"
$A exec-out screencap -p >"$OUT/51_pair_live.png"
echo "-- screencap: 51_pair_live.png ($(wc -c <"$OUT/51_pair_live.png" | tr -d ' ') bytes)"
prefs "after the launch with core=LIVE" | tee "$OUT/prefs_live.txt"

echo
echo "== B. Stack Check, by a deep link into the running app (no core= parameter: the choice is kept): demsdemo:///stack-check"
launch 'demsdemo:///stack-check'
wait_for 'DEMS-LIVE\] GET /api/v1/health 200' 60 || echo "-- no health line"
sleep 5
echo "-- focus: $(focus)"
$A exec-out screencap -p >"$OUT/51_stack_check_live.png"
echo "-- screencap: 51_stack_check_live.png ($(wc -c <"$OUT/51_stack_check_live.png" | tr -d ' ') bytes)"

echo
echo "-- the app's request lines in the device log ([DEMS-LIVE] method, path template, status, request ID):"
js | grep -o 'DEMS-LIVE\] .*' | tee "$OUT/device_requests.txt" | sort | uniq -c | sort -rn | awk '{ $1 = ""; print "  " $0 }' | head -n 14
echo "   request lines in all: $(grep -c . "$OUT/device_requests.txt")"
echo "-- runtime records of the Live start in the device log (source and context only):"
js | grep -E "runtime\.live\.|runtime\.debug\.core|live\.(socket|client|secrets|session|misuse)" | sed -E 's/^.*ReactNativeJS: //' | cut -c1-260 | head -n 14 | tee "$OUT/device_runtime_records.txt"
echo "-- a credential or a bearer value in the device log of this run (count of lines; must be 0):"
js | grep -c -E 'dvc_|ses_|bio_|[Bb]earer '
js | tail -n 120 >"$OUT/logcat_reactnativejs_tail.txt"
app_data "in LIVE mode, unpaired" | tee "$OUT/app_data_live.txt"

echo
echo "== C. back to the default: stop the app, then a launch with core=SIMULATED"
$A shell am force-stop "$APP_ID"
T1=$($A shell "date '+%m-%d %H:%M:%S.000'" | tr -d '\r')
launch 'demsdemo:///?core=SIMULATED'
i=0
until $A logcat -d -T "$T1" -s ReactNativeJS:V 2>/dev/null | grep -q 'runtime.sim.hydrated' || [ "$i" -ge 90 ]; do
  i=$((i + 1))
  sleep 1
done
echo "-- waited $i s for: runtime.sim.hydrated"
sleep 6
$A logcat -d -T "$T1" -s ReactNativeJS:V 2>/dev/null | grep -E "runtime\.debug\.core|runtime\.sim\.hydrated|DEMS-LIVE" | sed -E 's/^.*ReactNativeJS: //' | cut -c1-220 | head -n 6
echo "-- request lines to the Core server after the reset (must be 0): $($A logcat -d -T "$T1" -s ReactNativeJS:V 2>/dev/null | grep -c 'DEMS-LIVE')"
echo "-- focus: $(focus)"
$A exec-out screencap -p >"$OUT/51_after_reset_simulated.png"
echo "-- screencap: 51_after_reset_simulated.png ($(wc -c <"$OUT/51_after_reset_simulated.png" | tr -d ' ') bytes)"
prefs "after the launch with core=SIMULATED" | tee "$OUT/prefs_after.txt"
app_data "after the reset" | tee "$OUT/app_data_after.txt"

echo "-- Metro log (bundle and error lines):"
grep -E "Bundled|rror" "$METRO_LOG" | tail -n 8 | tee "$OUT/metro_tail.txt"
lock_state "end of the commands" | tee "$OUT/lock_state_end.txt"
echo "-- adb reverse --list (end of commands; device-session.sh removes its own rules after this):"
$A reverse --list
grep -q 'GET /api/v1/health 200' "$OUT/device_requests.txt"
