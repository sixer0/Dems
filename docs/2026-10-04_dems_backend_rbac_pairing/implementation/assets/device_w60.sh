#!/bin/sh
# W60 device commands (blueprint step 82): the gate on the PHONE (dems2_phone, emulator-5554), on
# lane 1. Runs INSIDE apps/mobile/scripts/device-session.sh: the device lock is held, Metro is up,
# the session's reverse rules are set (device tcp:4420 -> host tcp:$HOSTPORT).
#   $1 = run id, $2 = output folder, $3 = the backend's log file, $4 = the backend's host port.
#
# It shows: (A) the gate blocking an UNPAIRED device in LIVE mode — /pair is the only working screen,
# /login is not reachable; (B) pairing with a code issued by the lane-1 backend releases the gate into
# Login; (C) signing in there in LIVE mode on the now-paired phone (the evidence D138 transfers here);
# (D) leaving the app in SIMULATED mode as it was found.
#
# What this script does to the device, and nothing else: read-only queries; launches of the app by a
# deep link and a force-stop; taps on the app's OWN fields/buttons and `input text` into them. It sets,
# changes or clears NO lock, PIN, pattern, password or fingerprint, touches no fingerprint sensor, and
# types nothing into a lock screen. A locked device ends the script with 77 and is reported, not worked
# around. No screencap or UI dump is taken while the code slots hold digits.
set -u
RUN=$1
OUT=$2
SERVER_LOG=$3
HOSTPORT=$4
A="adb -s $SERIAL"
H="$ROOT/.cache/w60"
echo "-- serial $SERIAL ($AVD_NAME), app $APP_ID, Metro port $METRO_PORT, lane port $HOSTPORT, run $RUN"
$A reverse --list

lock_state() {
  echo "-- lock state ($1; read-only):"
  echo "   $($A shell dumpsys window 2>/dev/null | tr -d '\r' | grep -o 'isKeyguardShowing=[a-z]*' | head -n 1)"
  echo "   user 0: $($A shell dumpsys user 2>/dev/null | tr -d '\r' | grep -m 1 'State:' | sed 's/^ *//')"
  echo "   $($A shell dumpsys lock_settings 2>/dev/null | tr -d '\r' | grep -m 1 'CredentialType' | sed 's/^ *//')"
  echo "   fingerprints enrolled: $($A shell dumpsys fingerprint 2>/dev/null | tr -d '\r' | grep -o '"count":[0-9]*' | head -n 1)"
}
unlocked() {
  KG=$($A shell dumpsys window 2>/dev/null | tr -d '\r' | grep -o 'isKeyguardShowing=[a-z]*' | head -n 1)
  ST=$($A shell dumpsys user 2>/dev/null | grep -m 1 "State:" | tr -d '\r' | sed 's/^ *//')
  case "$KG/$ST" in
    isKeyguardShowing=false/*RUNNING_UNLOCKED*) return 0 ;;
    *) echo "-- $AVD_NAME is LOCKED ($KG; $ST) at: $1. The device part stops here; the user unlocks. Nothing was typed."; return 1 ;;
  esac
}
lock_state "start of the session" | tee "$OUT/lock_state_start.txt"
unlocked "the start" || exit 77

prefs() {
  printf '%s' "-- dems.mobile.prefs.v1 ($1; absent = SIMULATED default): "
  $A shell "run-as $APP_ID sh -c 'sqlite3 databases/RKStorage \"select value from catalystLocalStorage where key = \\\"dems.mobile.prefs.v1\\\"\" 2>&1'" | tr -d '\r'
  echo
}
secure_entries() {
  echo "-- secure-store entry NAMES ($1; none listed = none stored):"
  $A shell "run-as $APP_ID sh -c 'grep -o \"name=[^ >]*\" shared_prefs/SecureStore.xml 2>/dev/null'" | tr -d '\r' | sed 's/^/   entry: /'
}
secure_entries "before the first launch" | tee "$OUT/secure_before.txt"
prefs "before the first launch" | tee "$OUT/prefs_before.txt"

cur() { $A shell dumpsys window displays 2>/dev/null | tr -d '\r' | grep -m 1 -o 'cur=[0-9]*x[0-9]*' | sed 's/cur=//'; }
T0=$($A shell "date '+%m-%d %H:%M:%S.000'" | tr -d '\r')
echo "-- device time at the first launch: $T0; display $(cur)"
js() { $A logcat -d -T "$T0" -s ReactNativeJS:V 2>/dev/null; }
wait_for() { i=0; until js | grep -q -- "$1" || [ "$i" -ge "$2" ]; do i=$((i + 1)); sleep 1; done; echo "-- waited $i s for: $1"; js | grep -q -- "$1"; }
launch() { echo "-- am start -W -d '$1' $APP_ID"; $A shell "am start -W -a android.intent.action.VIEW -d '$1' $APP_ID" 2>&1 | tr -d '\r' | grep -E "Status|LaunchState|Activity|Error|TotalTime" | sed 's/^/   /'; }
focus() { $A shell dumpsys window 2>/dev/null | tr -d '\r' | grep -m 1 'mCurrentFocus' | sed 's/^ *//'; }
dump() { $A shell uiautomator dump /sdcard/w60_ui.xml >/dev/null 2>&1; $A shell cat /sdcard/w60_ui.xml >"$1" 2>/dev/null; $A shell rm -f /sdcard/w60_ui.xml; }
shot() {
  NAME="60_phone_$1"
  $A exec-out screencap -p >"$OUT/$NAME.png"
  echo "-- screencap: $NAME.png ($(wc -c <"$OUT/$NAME.png" | tr -d ' ') bytes), display $(cur), focus: $(focus)"
  dump "$OUT/ui_$NAME.xml"
  echo "-- which screens are present in the dump (screen-* test IDs):"
  node "$H/bounds.mjs" report "$OUT/ui_$NAME.xml" 2>/dev/null | head -n 1
  grep -o 'com.dems.demo.tablet:id/screen-[a-z-]*' "$OUT/ui_$NAME.xml" | sed 's#.*/id/##' | sort -u | sed 's/^/   screen: /'
}

echo
echo "== A. cold start in LIVE mode, NOT paired: the gate must hold the app on /pair =="
launch 'demsdemo:///pair?core=LIVE'
wait_for 'runtime.live.ready' 150 || echo "-- the Live source did not report ready"
sleep 6
unlocked "the unpaired screencap" || exit 77
prefs "after the launch with core=LIVE" | tee "$OUT/prefs_live.txt"
shot unpaired_pair
echo "-- A2. try to reach /login while blocked: demsdemo:///login?core=LIVE (must land back on /pair)"
launch 'demsdemo:///login?core=LIVE'
sleep 4
shot unpaired_login_attempt
echo "-- the boot router's target for this launch (from the runtime log):"
js | grep -E "runtime\.debug\.core|boot" | tail -n 3 | sed -E 's/^.*ReactNativeJS: //' | cut -c1-160 | sed 's/^/   /'

echo
echo "== B. pair with a code issued by the lane-1 backend; the gate releases into Login =="
unlocked "the pairing" || exit 77
dump "$OUT/ui_before_typing.xml"
AT=$(node "$H/bounds.mjs" center "$OUT/ui_before_typing.xml" pairing-code-input) || AT=$(node "$H/bounds.mjs" center "$OUT/ui_before_typing.xml" pairing-code-slot-0) || AT=""
if [ -z "$AT" ]; then
  echo "-- the code field was not found in the UI dump: nothing tapped, nothing typed"
  PAIR_EXIT=3
else
  echo "-- focus before the tap: $(focus)"
  case "$(focus)" in
    *"$APP_ID"*)
      echo "-- adb shell input tap $AT (centre of the app's code field)"
      # shellcheck disable=SC2086
      $A shell input tap $AT
      sleep 2
      (cd "$ROOT" && node --import tsx .cache/w60/issue_and_type.mts "$SERIAL" "$HOSTPORT" "$OUT" "$SERVER_LOG" "$T0")
      PAIR_EXIT=$?
      ;;
    *) echo "-- the app is not the focused window: nothing typed"; PAIR_EXIT=77 ;;
  esac
fi
echo "-- pairing step exit: $PAIR_EXIT (0 = Core answered 201 and the code was found nowhere)"
sleep 4
unlocked "the released Login screen" || exit 77
shot released_login

echo
echo "== C. sign in on the paired phone in LIVE mode (the D138 evidence) =="
dump "$OUT/ui_login_fields.xml"
UA=$(node "$H/bounds.mjs" center "$OUT/ui_login_fields.xml" login-username) || UA=""
PA=$(node "$H/bounds.mjs" center "$OUT/ui_login_fields.xml" login-password) || PA=""
SA=$(node "$H/bounds.mjs" center "$OUT/ui_login_fields.xml" login-submit) || SA=""
if [ -z "$UA" ] || [ -z "$PA" ] || [ -z "$SA" ]; then
  echo "-- a login field was not found (username='$UA' password='$PA' submit='$SA'): cannot sign in"
  SIGN_EXIT=3
else
  unlocked "the sign-in" || exit 77
  (cd "$ROOT" && node --import tsx .cache/w60/sign_in_live.mts "$SERIAL" "$HOSTPORT" "$OUT" "$SERVER_LOG" "$T0" "$UA" "$PA" "$SA")
  SIGN_EXIT=$?
fi
echo "-- sign-in step exit: $SIGN_EXIT (0 = Core answered 200 and no credential leaked)"
sleep 3
unlocked "the signed-in screencap" || exit 77
shot signed_in_home

echo
echo "== D. leave the app in SIMULATED mode as it was found =="
$A shell am force-stop "$APP_ID"
T1=$($A shell "date '+%m-%d %H:%M:%S.000'" | tr -d '\r')
launch 'demsdemo:///?core=SIMULATED'
i=0
until $A logcat -d -T "$T1" -s ReactNativeJS:V 2>/dev/null | grep -q 'runtime.sim.hydrated' || [ "$i" -ge 90 ]; do i=$((i + 1)); sleep 1; done
echo "-- waited $i s for: runtime.sim.hydrated"
sleep 4
prefs "after the launch with core=SIMULATED" | tee "$OUT/prefs_after.txt"
secure_entries "after the SIMULATED relaunch (the credential entry must still be listed)" | tee "$OUT/secure_after.txt"
echo "-- request lines to the Core server after the SIMULATED relaunch (must be 0): $($A logcat -d -T "$T1" -s ReactNativeJS:V 2>/dev/null | grep -c 'DEMS-LIVE')"

echo "-- the app's Core request lines this run ([DEMS-LIVE] method path status reqId):"
js | grep -o 'DEMS-LIVE\] .*' | sed -E 's/ [0-9a-f]{8}-[0-9a-f-]{27}$//' | sort | uniq -c | sort -rn | head -n 16 | sed 's/^/   /' | tee "$OUT/device_requests.txt"
echo "-- 'live.misuse' reports (must be 0): $(js | grep -c 'live\.misuse')"
echo "-- lines with a credential/token in the device JS log (must be 0): $(js | grep -c -E 'dvc_|ses_|bio_')"
echo "-- Metro bundle/error lines:"
grep -E "Bundled|rror" "$METRO_LOG" 2>/dev/null | tail -n 6 | cut -c1-200 | sed 's/^/   /'
echo "-- display at the end: $(cur)"
lock_state "end of the commands" | tee "$OUT/lock_state_end.txt"
$A reverse --list
# Overall exit: pairing must have succeeded (0); sign-in result reported separately.
[ "$PAIR_EXIT" -eq 0 ] || exit "$PAIR_EXIT"
exit "$SIGN_EXIT"
