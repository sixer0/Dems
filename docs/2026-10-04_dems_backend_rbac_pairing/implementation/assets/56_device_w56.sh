#!/bin/sh
# W56 device commands: the auth layer of LIVE mode on a device that is NOT paired. Runs INSIDE
# apps/mobile/scripts/device-session.sh: the device lock is held, Metro is up, the session's reverse
# rules are set (device tcp:4420 -> host tcp:4421). $1 = mode, $2 = output folder.
#
#   look     the Login screen in LIVE mode; where its controls are; the demo-operator list opened
#   attempt  the same, then ONE sign-in attempt through the app's own controls
#
# What it does on the device: queries, a launch of the app by a deep link, a force-stop of the app,
# screencaps, and TAPS ON THE APP'S OWN CONTROLS (`input tap` on the Login screen: the "Demo
# operators" row, one operator, Sign In). It types nothing. It never touches the fingerprint
# button, the fingerprint sensor (`emu finger`), a lock screen, a PIN, a lock or a device setting,
# and it sets no reverse rule. If the device shows its keyguard it stops with 77.
#
# The demo password: the operator row puts it into the app's own form, inside the app. This script
# never reads or prints it. A screencap that could show the list with the demo hint is written
# to the scratch folder only (scratch_*.png) and becomes a document only after it was looked at.
# Env: TAP_TRIGGER, TAP_OPERATOR, TAP_SUBMIT ("x y" each): the positions of the three controls.
set -u
MODE=$1
OUT=$2
A="adb -s $SERIAL"
echo "-- serial $SERIAL ($AVD_NAME), app $APP_ID, Metro port $METRO_PORT, mode $MODE"
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
if $A shell dumpsys window 2>/dev/null | grep -q 'isKeyguardShowing=true'; then
  echo "-- $AVD_NAME shows its keyguard. The device part stops here; the user unlocks the device."
  exit 77
fi

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
app_data "before the first launch"
prefs "before the first launch"

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

tap() {
  echo "-- input tap $2 $3   ($1)"
  $A shell input tap "$2" "$3"
}

echo
echo "== A. cold start in LIVE mode on the Login screen: demsdemo:///login?core=LIVE (the device is not paired)"
launch 'demsdemo:///login?core=LIVE'
wait_for 'runtime.live.ready' 150 || echo "-- the Live source did not report ready"
wait_for 'DEMS-LIVE\] GET /api/v1/auth/session' 30 || echo "-- no session probe line"
sleep 6
echo "-- focus: $(focus)"
$A exec-out screencap -p >"$OUT/56_login_live_unpaired.png"
echo "-- screencap: 56_login_live_unpaired.png ($(wc -c <"$OUT/56_login_live_unpaired.png" | tr -d ' ') bytes)"
prefs "after the launch with core=LIVE"
# The view dump (`uiautomator dump`) cannot be taken on this screen: it answers "could not get
# idle state" (the Login screen animates without end). So the controls are addressed by position,
# read from screencaps of this build: TAP_TRIGGER, TAP_OPERATOR, TAP_SUBMIT ("x y" each).

# The Login screen opens with its Username field focused, so the soft keyboard covers the lower
# half. A tap is made only while the keyboard is closed and the app is in front. BACK closes an
# open keyboard (Android takes the key for the keyboard; it is sent only while one is shown).
keyboard() { $A shell dumpsys input_method 2>/dev/null | tr -d '\r' | grep -o 'mInputShown=[a-z]*' | head -n 1; }
K=$(keyboard)
echo "-- soft keyboard: $K"
if [ "$K" = "mInputShown=true" ]; then
  echo "-- input keyevent 4 (BACK: closes the soft keyboard)"
  $A shell input keyevent 4
  sleep 2
  K=$(keyboard)
  echo "-- soft keyboard after BACK: $K"
fi
F=$(focus)
echo "-- focus before the taps: $F"
READY=1
[ "$K" = "mInputShown=false" ] || READY=0
case "$F" in
  *"$APP_ID"*) ;;
  *) READY=0 ;;
esac
TRIGGER=${TAP_TRIGGER:-}
if [ "$READY" -ne 1 ] || [ -z "$TRIGGER" ]; then
  echo "-- no tap is made (the keyboard is open, the app is not in front, or no position was given)"
  $A exec-out screencap -p >"$OUT/scratch_not_ready.png"
  echo "-- screencap (scratch): scratch_not_ready.png"
else
  $A exec-out screencap -p >"$OUT/scratch_no_keyboard.png"
  echo "-- screencap (scratch): scratch_no_keyboard.png"
  echo
  echo "== B. the demo-operator list is opened (a tap on the app's own row)"
  # shellcheck disable=SC2086
  tap "Demo operators" $TRIGGER
  sleep 2
  OPERATOR=${TAP_OPERATOR:-}
  if [ "$MODE" = "look" ] || [ -z "$OPERATOR" ] || [ -z "${TAP_SUBMIT:-}" ]; then
    # Scratch only: this picture shows the demo hint and is never copied to the documents.
    $A exec-out screencap -p >"$OUT/scratch_expanded.png"
    echo "-- screencap (scratch, not a document): scratch_expanded.png"
    # shellcheck disable=SC2086
    tap "Demo operators, closed again" $TRIGGER
    sleep 2
    $A exec-out screencap -p >"$OUT/scratch_closed.png"
    echo "-- screencap (scratch): scratch_closed.png; no sign-in attempt in this run"
  else
    echo
    echo "== C. ONE sign-in attempt on the unpaired device, through the app's own controls"
    # shellcheck disable=SC2086
    tap "one demo operator: the app fills its own form" $OPERATOR
    sleep 2
    $A exec-out screencap -p >"$OUT/scratch_filled.png"
    echo "-- screencap (scratch): scratch_filled.png; soft keyboard: $(keyboard)"
    # shellcheck disable=SC2086
    tap "Sign In" $TAP_SUBMIT
    wait_for 'not paired with the Core server' 20 || echo "-- the auth layer's refusal line did not appear"
    sleep 3
    # Scratch until it was looked at: it becomes a document only if the demo hint is not on it.
    $A exec-out screencap -p >"$OUT/scratch_refused.png"
    echo "-- screencap (scratch until it was looked at): scratch_refused.png"
  fi
fi

echo
echo "-- the app's request lines in the device log ([DEMS-LIVE] method, path template, status, request ID):"
js | grep -o 'DEMS-LIVE\] .*' | tee "$OUT/device_requests.txt" | sed -E 's/ [0-9a-f-]{36}$//' | sort | uniq -c | awk '{ print "  " $0 }' | head -n 14
echo "   request lines in all: $(grep -c . "$OUT/device_requests.txt")"
echo "   sign-in request lines (POST /api/v1/auth/sign-in or /auth/biometric...; must be 0): $(grep -c -E 'POST /api/v1/auth/(sign-in|biometric)' "$OUT/device_requests.txt")"
echo "-- records of the auth layer and of the Live start in the device log (source, message, context):"
js | grep -A 2 -E "source: '(auth\.|runtime\.live\.|runtime\.debug\.core|live\.)" | sed -E 's/^.*ReactNativeJS: //' | grep -v '^--$' | cut -c1-200 | head -n 30 | tee "$OUT/device_runtime_records.txt"
echo "-- a misuse report of a Live action (live.misuse) in the device log (count; must be 0): $(js | grep -c 'live\.misuse')"
echo "-- an error of the JS runtime in the device log (lines with 'Error:' or 'Invariant'; count): $(js | grep -c -E 'Error:|Invariant Violation|Rendered (more|fewer) hooks')"
js | grep -E 'Error:|Invariant Violation|Rendered (more|fewer) hooks' | sed -E 's/^.*ReactNativeJS: //' | cut -c1-220 | head -n 6 | sed 's/^/   /'
echo "-- a credential, a bearer value or a password in the device log of this run (count of lines; must be 0):"
js | grep -c -E 'dvc_|ses_|bio_|[Bb]earer |assword":|password='
app_data "in LIVE mode, unpaired, after the attempt"

echo
echo "== D. back to the default: stop the app, then a launch with core=SIMULATED"
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
$A logcat -d -T "$T1" -s ReactNativeJS:V 2>/dev/null | grep -E "runtime\.debug\.core|runtime\.sim\.hydrated|DEMS-LIVE" | sed -E 's/^.*ReactNativeJS: //' | cut -c1-200 | head -n 4
echo "-- request lines to the Core server after the reset (must be 0): $($A logcat -d -T "$T1" -s ReactNativeJS:V 2>/dev/null | grep -c 'DEMS-LIVE')"
echo "-- focus: $(focus)"
$A exec-out screencap -p >"$OUT/56_after_reset_simulated.png"
echo "-- screencap: 56_after_reset_simulated.png ($(wc -c <"$OUT/56_after_reset_simulated.png" | tr -d ' ') bytes)"
prefs "after the launch with core=SIMULATED"
app_data "after the reset"
echo "-- Metro log (bundle and error lines):"
grep -E "Bundled|rror" "$METRO_LOG" | tail -n 6
lock_state "end of the commands" | tee "$OUT/lock_state_end.txt"
echo "-- adb reverse --list (end of commands; device-session.sh removes its own rules after this):"
$A reverse --list
exit 0
