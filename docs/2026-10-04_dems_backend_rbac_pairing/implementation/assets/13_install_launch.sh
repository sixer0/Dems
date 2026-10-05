#!/bin/sh
# W13 session commands (run by device-session.sh with the device lock held, cwd apps/mobile).
# install -r (no uninstall, no data wipe), package and data checks, ONE launch through the lane Metro, screencap.
# $1 = scratch folder, $2 = SHA-256 of the APK to install
set -u
S=$1
EXPECT_SHA=$2
APK="$ROOT/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
OUT="$ROOT/docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets"
pkg() { adb -s "$SERIAL" shell dumpsys package "$APP_ID" | grep -E "versionName|versionCode|signatures=|firstInstallTime|lastUpdateTime|pkgFlags|codePath|ceDataInode|dataDir=" | sed 's/^ *//' | tr -d '\r'; }
# Per-file SHA-256 of the app's private data (names and hashes only, never content); caches left out.
data_list() {
  adb -s "$SERIAL" shell "run-as $APP_ID sh" <<'EOS' | tr -d '\r'
find . -type f ! -path './cache/*' ! -path './code_cache/*' | sort | while IFS= read -r f; do sha256sum "$f"; done
EOS
}
echo "== $AVD_NAME $SERIAL commands start $(date '+%H:%M:%S'); METRO_PORT=${METRO_PORT:-none}; DEMS_CORE_HOST_PORT=${DEMS_CORE_HOST_PORT:-<unset>}"
echo "-- reverse rules during the session (set by the helper)"
adb -s "$SERIAL" reverse --list | tr -d '\r'
echo "-- user state: $(adb -s "$SERIAL" shell dumpsys user | grep -E "State: " | head -n 1 | sed 's/^ *//' | tr -d '\r'); keyguard: $(adb -s "$SERIAL" shell dumpsys window | grep -E "isKeyguardShowing" | head -n 1 | sed 's/^ *//' | tr -d '\r')"
echo "   (RUNNING_LOCKED = not unlocked since boot: run-as cannot reach the app's data folder; the package manager's ceDataInode / deDataInode are compared instead)"
echo "-- host APK"
ls -la "$APK"
have=$(shasum -a 256 "$APK" | cut -d' ' -f1)
echo "sha256 $have"
[ "$have" = "$EXPECT_SHA" ] || { echo "STOP: the APK is not the one that was verified"; exit 21; }
echo "-- package BEFORE install"
pkg
data_list >"$S/${AVD_NAME}_data_before.txt"
echo "-- app data BEFORE install: $(wc -l <"$S/${AVD_NAME}_data_before.txt" | tr -d ' ') files, list sha256 $(shasum -a 256 "$S/${AVD_NAME}_data_before.txt" | cut -d' ' -f1)"
echo "-- INSTALL_START $(date '+%H:%M:%S'): adb -s $SERIAL install -r <app-debug.apk>"
iout=$(adb -s "$SERIAL" install -r "$APK" 2>&1 | tr -d '\r')
printf '%s\n' "$iout"
echo "-- INSTALL_END $(date '+%H:%M:%S')"
echo "-- package AFTER install"
pkg
if ! printf '%s\n' "$iout" | grep -q '^Success'; then
  echo "STOP: adb install -r did not print Success (no uninstall was run; nothing was wiped)"
  exit 20
fi
bp=$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r' | sed -n 's/^package://p' | head -n 1)
echo "-- base.apk on the device: $(adb -s "$SERIAL" shell sha256sum "$bp" | tr -d '\r' | cut -d' ' -f1)  (host APK: $have)"
data_list >"$S/${AVD_NAME}_data_after.txt"
echo "-- app data AFTER install (app not started yet): $(wc -l <"$S/${AVD_NAME}_data_after.txt" | tr -d ' ') files, list sha256 $(shasum -a 256 "$S/${AVD_NAME}_data_after.txt" | cut -d' ' -f1)"
if cmp -s "$S/${AVD_NAME}_data_before.txt" "$S/${AVD_NAME}_data_after.txt"; then echo "   app data: IDENTICAL before and after the install"; else echo "   app data: DIFFERS:"; diff "$S/${AVD_NAME}_data_before.txt" "$S/${AVD_NAME}_data_after.txt" | cut -c1-200 | head -n 20; fi
echo "-- pidof before launch: [$(adb -s "$SERIAL" shell pidof "$APP_ID" | tr -d '\r')]"

if [ -z "${METRO_PORT:-}" ] || [ "${NO_METRO:-0}" = 1 ]; then echo "== no Metro in this session; no launch"; exit 0; fi

echo "-- LAUNCH $(date '+%H:%M:%S') (one launch; the lane Metro serves the bundle)"
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
node "$S/cdp_probe.mjs" "$METRO_PORT"
adb -s "$SERIAL" exec-out screencap -p >"$OUT/13_${AVD_NAME}_launch.png"
ls -la "$OUT/13_${AVD_NAME}_launch.png"
echo "-- logcat of the app process: FATAL / JS error lines"
adb -s "$SERIAL" logcat -d ${pid:+--pid=$pid} 2>/dev/null | tr -d '\r' | grep -E "FATAL EXCEPTION|E ReactNativeJS|E AndroidRuntime|E unknown:ReactNative" | cut -c1-240 | head -n 12
echo "   (end of logcat filter)"
echo "== $AVD_NAME commands end $(date '+%H:%M:%S')"
