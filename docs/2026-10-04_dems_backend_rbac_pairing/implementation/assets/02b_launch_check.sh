#!/bin/sh
# Row W02b (D58), step 9: runs step 35's launch check UNCHANGED (13_launch_check.sh) on a new,
# lock-free emulator and keeps a copy of its screencap as 02b_<avd>_launch.png. Session commands
# for apps/mobile/scripts/device-session.sh with a Metro lane. From the workspace root, outside the
# sandbox, one emulator after the other (tablet, phone2, phone):
#
#   A=docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets
#   METRO_PORT=8085 DEVICE_SESSION_MAX_SECONDS=600 apps/mobile/scripts/device-session.sh tablet "/bin/sh '$PWD/$A/02b_launch_check.sh'"
#
# After the launch it adds two read-only facts: the texts on screen (uiautomator dump to stdout, no
# file is written on the device) and the keyguard state. It signs in nowhere, pairs nothing, types
# nothing into the app and changes no setting.
set -u
ASSETS="$ROOT/docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets"
/bin/sh "$ASSETS/13_launch_check.sh"
st=$?
echo "-- 13_launch_check.sh status: $st"
if [ -s "$ASSETS/13_${AVD_NAME}_launch.png" ]; then
  cp -p "$ASSETS/13_${AVD_NAME}_launch.png" "$ASSETS/02b_${AVD_NAME}_launch.png"
  ls -la "$ASSETS/02b_${AVD_NAME}_launch.png"
  echo "screencap sha256: $(shasum -a 256 "$ASSETS/02b_${AVD_NAME}_launch.png" | cut -d' ' -f1)"
fi
echo "-- texts on screen (read-only: uiautomator dump /dev/tty)"
raw=$(adb -s "$SERIAL" exec-out uiautomator dump /dev/tty 2>&1 | tr -d '\r')
printf '%s\n' "$raw" | /usr/bin/perl -ne 'while (/ (?:text|content-desc)="([^"]*)"/g) { print "$1\n" if length $1 }' |
  awk '!seen[$0]++' | head -n 40 >"$ASSETS/02b_${AVD_NAME}_ui_texts.txt"
cat "$ASSETS/02b_${AVD_NAME}_ui_texts.txt"
n=$(wc -l <"$ASSETS/02b_${AVD_NAME}_ui_texts.txt" | tr -d ' ')
echo "   ($n distinct texts)"
# No text is not a failure of the launch: uiautomator needs an idle window and the login screen animates.
[ "$n" -gt 0 ] || { echo "   uiautomator said: $(printf '%s' "$raw" | cut -c1-160)"; rm -f "$ASSETS/02b_${AVD_NAME}_ui_texts.txt"; }
adb -s "$SERIAL" shell dumpsys window | grep -o 'isKeyguardShowing=[a-z]*' | head -n 1
adb -s "$SERIAL" shell dumpsys package "$APP_ID" | grep -E "firstInstallTime|lastUpdateTime" | sed 's/^ *//' | tr -d '\r'
exit "$st"
