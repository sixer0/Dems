#!/bin/sh
# W57 device commands, second session: the LAYOUT of the Pair screen on the TABLET in both
# orientations, in SIMULATED mode (is the layout as the predecessor left it?) and in LIVE mode on
# the now PAIRED tablet (a cold start reads the stored credential). Nothing is paired, unpaired,
# typed or tapped here. Runs INSIDE apps/mobile/scripts/device-session.sh: the device lock is held,
# Metro is up, the session's reverse rules are set (device tcp:4420 -> host tcp:4422).
#   $1 = run id, $2 = output folder, $3 = the backend's log file, $4 = the backend's host port.
#
# What this script does to the device, and nothing else:
#   - queries (dumpsys, getprop, logcat, run-as reads of key NAMES and value LENGTHS, uiautomator dump);
#   - launches of the app by a deep link, and a force-stop of the app;
#   - `adb emu rotate` (the emulator turns the virtual tablet by 90 degrees; the project's documented
#     way to check both orientations), and as many turns again as bring it back to the start pose;
# It sets, changes or clears NO lock, PIN, pattern, password or fingerprint, changes no device
# setting, touches no fingerprint sensor, and types nothing into a lock screen. A locked device
# ends the script with 77 and is reported, not worked around.
# No screencap and no UI dump is taken while the code slots hold digits.
set -u
RUN=$1
OUT=$2
SERVER_LOG=$3
HOSTPORT=$4
A="adb -s $SERIAL"
H="$ROOT/.cache/w57"
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
# The device is usable only while it is unlocked. Checked before every step that touches the app.
unlocked() {
  KG=$($A shell dumpsys window 2>/dev/null | tr -d '\r' | grep -o 'isKeyguardShowing=[a-z]*' | head -n 1)
  ST=$($A shell dumpsys user 2>/dev/null | grep -m 1 "State:" | tr -d '\r' | sed 's/^ *//')
  case "$KG/$ST" in
    isKeyguardShowing=false/*RUNNING_UNLOCKED*) return 0 ;;
    *)
      echo "-- $AVD_NAME is LOCKED ($KG; $ST) at: $1. The device part stops here; the user unlocks the device. Nothing was typed."
      return 1
      ;;
  esac
}
lock_state "start of the session" | tee "$OUT/lock_state_start.txt"
unlocked "the start" || exit 77

# What the app has stored: names and sizes only. The secure-store file is read for its ENTRY NAMES
# only (grep -o of the name attribute); no value of it is read, printed or copied.
app_data() {
  echo "-- app data ($1): AsyncStorage keys with the length of each value; names of the secure-store entries"
  $A shell "run-as $APP_ID sh -c 'sqlite3 databases/RKStorage \"select key, length(value) from catalystLocalStorage order by key\" 2>&1'" | tr -d '\r' | sed 's/^/   key: /'
  echo "   secure-store entries (entry names of shared_prefs/SecureStore.xml; none listed = none stored):"
  $A shell "run-as $APP_ID sh -c 'grep -o \"name=[^ >]*\" shared_prefs/SecureStore.xml 2>/dev/null'" | tr -d '\r' | sed 's/^/   entry: /'
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

cur() { $A shell dumpsys window displays 2>/dev/null | tr -d '\r' | grep -m 1 -o 'cur=[0-9]*x[0-9]*' | sed 's/cur=//'; }
shape() {
  W=${1%x*}
  HH=${1#*x}
  if [ "$W" -gt "$HH" ]; then echo landscape; else echo portrait; fi
}
START_POSE=$(cur)
echo "-- display at the start: $START_POSE ($(shape "$START_POSE")); the emulator is turned back to this pose at the end"

T0=$($A shell "date '+%m-%d %H:%M:%S.000'" | tr -d '\r')
echo "-- device time at the first launch: $T0"
js() { $A logcat -d -T "$T0" -s ReactNativeJS:V 2>/dev/null; }
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
# A screencap and a UI dump of the Pair screen. Only called with the slots empty or on the paired view.
shot() {
  NAME="57_tablet_$(shape "$(cur)")_$1"
  $A exec-out screencap -p >"$OUT/$NAME.png"
  echo "-- screencap: $NAME.png ($(wc -c <"$OUT/$NAME.png" | tr -d ' ') bytes), display $(cur), focus: $(focus)"
  $A shell uiautomator dump /sdcard/w57_ui.xml >/dev/null 2>&1
  $A shell cat /sdcard/w57_ui.xml >"$OUT/ui_$NAME.xml" 2>/dev/null
  $A shell rm -f /sdcard/w57_ui.xml
  echo "-- UI dump of that screen (test IDs, bounds, texts):"
  node "$H/bounds.mjs" report "$OUT/ui_$NAME.xml" | tee "$OUT/bounds_$NAME.txt"
}
# Turns the virtual tablet by 90 degrees until the display has the wanted shape (at most 4 turns).
turn_to() {
  n=0
  while [ "$(shape "$(cur)")" != "$1" ] && [ "$n" -lt 4 ]; do
    $A emu rotate >/dev/null 2>&1
    n=$((n + 1))
    sleep 3
  done
  TURNS=$((TURNS + n))
  echo "-- adb emu rotate x$n -> display $(cur) ($(shape "$(cur)"))"
  [ "$(shape "$(cur)")" = "$1" ]
}
turn_back() {
  n=0
  while [ "$(cur)" != "$START_POSE" ] && [ "$n" -lt 4 ]; do
    $A emu rotate >/dev/null 2>&1
    n=$((n + 1))
    sleep 3
  done
  TURNS=$((TURNS + n))
  # A turn of 180 degrees gives the same size: go on to a full circle, so the pose is the start's.
  while [ $((TURNS % 4)) -ne 0 ]; do
    $A emu rotate >/dev/null 2>&1
    TURNS=$((TURNS + 1))
    n=$((n + 1))
    sleep 3
  done
  echo "-- adb emu rotate x$n -> display $(cur) ($(shape "$(cur)")); turns in all: $TURNS (a multiple of 4 = the start pose)"
}
TURNS=0
OTHER=portrait
[ "$(shape "$START_POSE")" = portrait ] && OTHER=landscape


echo
echo "== A. SIMULATED mode, cold start in the start pose: demsdemo:///pair?core=SIMULATED"
launch 'demsdemo:///pair?core=SIMULATED'
wait_for 'runtime.sim.hydrated' 150 || echo "-- the simulator did not report ready"
sleep 6
unlocked "the Simulated screencap" || exit 77
prefs "after the launch with core=SIMULATED" | tee "$OUT/prefs_simulated.txt"
shot simulated
echo "-- the other orientation, turned WHILE THE SCREEN IS OPEN:"
if turn_to "$OTHER"; then
  sleep 3
  shot simulated_after_turn
else
  echo "-- the display did not follow the turn: no $OTHER screencap"
fi

echo
echo "== B. SIMULATED mode, COLD START in the turned pose ($(shape "$(cur)")): demsdemo:///pair"
$A shell am force-stop "$APP_ID"
sleep 1
launch 'demsdemo:///pair'
sleep 12
unlocked "the Simulated cold-start screencap" || exit 77
shot simulated_coldstart

echo
echo "== C. LIVE mode on the PAIRED tablet, COLD START in the turned pose ($(shape "$(cur)")): demsdemo:///pair?core=LIVE"
$A shell am force-stop "$APP_ID"
sleep 1
T2=$($A shell "date '+%m-%d %H:%M:%S.000'" | tr -d '\r')
launch 'demsdemo:///pair?core=LIVE'
i=0
until $A logcat -d -T "$T2" -s ReactNativeJS:V 2>/dev/null | grep -q 'pairing/device 200' || [ "$i" -ge 90 ]; do
  i=$((i + 1))
  sleep 1
done
echo "-- waited $i s for the registration read of the stored credential (GET /api/v1/pairing/device 200)"
sleep 6
unlocked "the paired cold-start screencap" || exit 77
shot paired_coldstart
echo "-- back to the start pose, turned WHILE THE SCREEN IS OPEN:"
turn_back
sleep 3
shot paired_after_turn

echo
echo "-- the app's request lines of the LIVE start in the device log ([DEMS-LIVE] method, path template, status):"
$A logcat -d -T "$T2" -s ReactNativeJS:V 2>/dev/null | grep -o 'DEMS-LIVE\] .*' | tee "$OUT/device_requests.txt" | sed -E 's/ [0-9a-f]{8}-[0-9a-f-]{27}$//' | sort | uniq -c | awk '{ c = $1; $1 = ""; print "  " c " x" $0 }'
echo "-- runtime records of the LIVE start (source lines):"
$A logcat -d -T "$T2" -s ReactNativeJS:V 2>/dev/null | grep -E "source: '(PairingScreen|runtime\.live|runtime\.debug\.core|live\.)" | sed -E 's/^.*ReactNativeJS: //' | sort | uniq -c | head -n 12
echo "-- 'live.misuse' reports (must be 0): $($A logcat -d -T "$T2" -s ReactNativeJS:V 2>/dev/null | grep -c 'live\.misuse')"
echo "-- lines with a credential or a bearer value in the device log of this session (must be 0): $(js | grep -c -E 'dvc_|ses_|bio_|[Bb]earer ')"
app_data "PAIRED, in LIVE mode, after the cold start" | tee "$OUT/app_data_paired.txt"

echo
echo "== D. the default source again: stop the app, then a launch with core=SIMULATED. The stored credential is not touched by it."
$A shell am force-stop "$APP_ID"
T1=$($A shell "date '+%m-%d %H:%M:%S.000'" | tr -d '\r')
launch 'demsdemo:///?core=SIMULATED'
i=0
until $A logcat -d -T "$T1" -s ReactNativeJS:V 2>/dev/null | grep -q 'runtime.sim.hydrated' || [ "$i" -ge 90 ]; do
  i=$((i + 1))
  sleep 1
done
echo "-- waited $i s for: runtime.sim.hydrated"
sleep 5
echo "-- request lines to the Core server after the reset (must be 0): $($A logcat -d -T "$T1" -s ReactNativeJS:V 2>/dev/null | grep -c 'DEMS-LIVE')"
prefs "after the launch with core=SIMULATED" | tee "$OUT/prefs_after.txt"
app_data "after the launch with core=SIMULATED (the credential entry must still be listed)" | tee "$OUT/app_data_after.txt"

echo "-- Metro log (bundle and error lines):"
grep -E "Bundled|rror" "$METRO_LOG" | tail -n 8 | cut -c1-220 | tee "$OUT/metro_tail.txt"
echo "-- display at the end: $(cur) (start: $START_POSE); turns in all: $TURNS"
lock_state "end of the commands" | tee "$OUT/lock_state_end.txt"
echo "-- adb reverse --list (end of commands; device-session.sh removes its own rules after this):"
$A reverse --list
exit 0
