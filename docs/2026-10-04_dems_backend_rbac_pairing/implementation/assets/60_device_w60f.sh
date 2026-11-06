#!/bin/sh
# W60 device commands, session F (the D138 LIVE sign-in, careful focus + keyboard submit). The phone
# is paired with lane 1. Boot route in LIVE mode → /login → sign in → /home → leave SIMULATED.
set -u
RUN=$1; OUT=$2; SERVER_LOG=$3; HOSTPORT=$4
A="adb -s $SERIAL"; H="$ROOT/.cache/w60"
echo "-- serial $SERIAL ($AVD_NAME), lane port $HOSTPORT, run $RUN (session F)"
unlocked() {
  KG=$($A shell dumpsys window 2>/dev/null | tr -d '\r' | grep -o 'isKeyguardShowing=[a-z]*' | head -n 1)
  ST=$($A shell dumpsys user 2>/dev/null | grep -m 1 "State:" | tr -d '\r' | sed 's/^ *//')
  case "$KG/$ST" in isKeyguardShowing=false/*RUNNING_UNLOCKED*) return 0 ;; *) echo "-- LOCKED ($KG; $ST) at: $1 — stop, report."; return 1 ;; esac
}
echo "-- lock: $($A shell dumpsys window 2>/dev/null|tr -d '\r'|grep -o 'isKeyguardShowing=[a-z]*'|head -n1); fps $($A shell dumpsys fingerprint 2>/dev/null|tr -d '\r'|grep -o '"count":[0-9]*'|head -n1)"
unlocked "the start" || exit 77
T0=$($A shell "date '+%m-%d %H:%M:%S.000'" | tr -d '\r')
js() { $A logcat -d -T "$T0" -s ReactNativeJS:V 2>/dev/null; }
wait_for() { i=0; until js | grep -q -- "$1" || [ "$i" -ge "$2" ]; do i=$((i + 1)); sleep 1; done; echo "-- waited $i s for: $1"; }
launch() { echo "-- am start -W -d '$1'"; $A shell "am start -W -a android.intent.action.VIEW -d '$1' $APP_ID" 2>&1 | tr -d '\r' | grep -E "Status|LaunchState|Error|TotalTime" | sed 's/^/   /'; }
focus() { $A shell dumpsys window 2>/dev/null | tr -d '\r' | grep -m 1 'mCurrentFocus' | sed 's/^ *//'; }
shot() { NAME="60_phone_$1"; $A exec-out screencap -p >"$OUT/$NAME.png"; echo "-- screencap: $NAME.png ($(wc -c <"$OUT/$NAME.png"|tr -d ' ') bytes), focus: $(focus)"; }

echo "== D1. boot route in LIVE mode on the PAIRED phone → /login =="
launch 'demsdemo:///?core=LIVE'
wait_for 'runtime.live.ready' 150
wait_for 'DEMS-LIVE\] GET /api/v1/pairing/device 200' 40
sleep 8
unlocked "the login" || exit 77
shot login
# Ensure the app window has input focus before the first field tap (a cold window can swallow it).
$A shell input tap 540 700   # neutral area (the brand emblem), no control there
sleep 1

echo "== D2. sign in on the paired phone in LIVE mode (the D138 evidence) =="
# Field centres measured off the on-device Login layout (phone portrait 1080x2424): username ~1105,
# password ~1265, Sign In button ~1430 (confirmed by pixel analysis of the captured screen).
UA="540 1105"; PA="540 1265"; SA="540 1430"
unlocked "the sign-in" || exit 77
(cd "$ROOT" && node --import tsx .cache/w60/sign_in_live4.mts "$SERIAL" "$HOSTPORT" "$OUT" "$SERVER_LOG" "$T0" "$UA" "$PA" "$SA")
SIGN_EXIT=$?
echo "-- sign-in step exit: $SIGN_EXIT (0 = Core answered 200 and no credential leaked)"
sleep 5
unlocked "the home" || exit 77
shot signed_in_home
echo "-- Core request lines this session:"
js | grep -o 'DEMS-LIVE\] .*' | sed -E 's/ [0-9a-f]{8}-[0-9a-f-]{27}$//' | sort | uniq -c | sort -rn | head -n 12 | sed 's/^/   /'
echo "-- live.misuse (must be 0): $(js | grep -c 'live\.misuse'); credential/token lines (must be 0): $(js | grep -c -E 'dvc_|ses_|bio_')"

echo "== D3. leave the app in SIMULATED mode as found =="
$A shell am force-stop "$APP_ID"
T1=$($A shell "date '+%m-%d %H:%M:%S.000'" | tr -d '\r')
launch 'demsdemo:///?core=SIMULATED'
i=0; until $A logcat -d -T "$T1" -s ReactNativeJS:V 2>/dev/null | grep -q 'runtime.sim.hydrated' || [ "$i" -ge 90 ]; do i=$((i + 1)); sleep 1; done
echo "-- waited $i s for runtime.sim.hydrated; Core requests after (must be 0): $($A logcat -d -T "$T1" -s ReactNativeJS:V 2>/dev/null | grep -c 'DEMS-LIVE')"
printf '%s' "-- prefs after: "; $A shell "run-as $APP_ID sh -c 'sqlite3 databases/RKStorage \"select value from catalystLocalStorage where key = \\\"dems.mobile.prefs.v1\\\"\"'" 2>/dev/null | tr -d '\r'; echo
echo "-- lock at end: $($A shell dumpsys window 2>/dev/null|tr -d '\r'|grep -o 'isKeyguardShowing=[a-z]*'|head -n1); fps $($A shell dumpsys fingerprint 2>/dev/null|tr -d '\r'|grep -o '"count":[0-9]*'|head -n1)"
exit "$SIGN_EXIT"
