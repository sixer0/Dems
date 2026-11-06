#!/bin/sh
# Row W02b (D58), step 8: fresh install of the current debug APK on a new, lock-free emulator.
# Session commands for apps/mobile/scripts/device-session.sh (the device lock is held). From the
# workspace root, outside the sandbox:
#
#   A=docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets
#   NO_METRO=1 DEVICE_SESSION_MAX_SECONDS=600 apps/mobile/scripts/device-session.sh phone "/bin/sh '$PWD/$A/02b_install.sh'"
#
# It checks the APK's SHA-256 on the host, installs it (no -r: the device has no DEMS app), and
# reads back the package facts and the hash of base.apk on the device. It does not start the app,
# enters nothing on the device and changes no setting.
set -u
APK="$ROOT/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
WANT=d89c9be31fb43e2b46361c26e357db1ffc7a4d9ba46e56af5230f7d57f8a14ec
echo "== $AVD_NAME $SERIAL $(date '+%H:%M:%S')"
echo "emu avd name: $(adb -s "$SERIAL" emu avd name | head -n 1 | tr -d '\r')"
adb -s "$SERIAL" shell dumpsys window | grep -o 'isKeyguardShowing=[a-z]*' | head -n 1
adb -s "$SERIAL" shell dumpsys user | grep -E 'State: ' | head -n 1 | sed 's/^ *//' | tr -d '\r'
have=$(shasum -a 256 "$APK" | cut -d' ' -f1)
echo "host APK: $(stat -f %z "$APK") bytes, sha256 $have"
[ "$have" = "$WANT" ] || { echo "STOP: the APK is not the step-35 debug build ($WANT)"; exit 40; }
before=$(adb -s "$SERIAL" shell pm list packages "$APP_ID" | tr -d '\r')
echo "package before: [${before}]"
[ -z "$before" ] || { echo "STOP: $APP_ID is already installed; this row installs on a fresh device only"; exit 41; }
echo "-- INSTALL_START $(date '+%H:%M:%S'): adb -s $SERIAL install <app-debug.apk>"
adb -s "$SERIAL" install "$APK" 2>&1 | tr -d '\r' | tail -n 3
echo "-- INSTALL_END $(date '+%H:%M:%S')"
echo "package after: [$(adb -s "$SERIAL" shell pm list packages "$APP_ID" | tr -d '\r')]"
adb -s "$SERIAL" shell dumpsys package "$APP_ID" | grep -E "versionCode|versionName|firstInstallTime|lastUpdateTime|signatures=" | sed 's/^ *//' | tr -d '\r'
bp=$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r' | sed -n 's/^package://p' | head -n 1)
dev=$(adb -s "$SERIAL" shell sha256sum "$bp" | tr -d '\r' | cut -d' ' -f1)
echo "base.apk on the device: $dev"
[ "$dev" = "$WANT" ] && echo "base.apk: MATCH (= host APK)" || { echo "base.apk: MISMATCH"; exit 42; }
echo "app process after install (not started by this script): [$(adb -s "$SERIAL" shell pidof "$APP_ID" | tr -d '\r')]"
echo "== $AVD_NAME end $(date '+%H:%M:%S')"
