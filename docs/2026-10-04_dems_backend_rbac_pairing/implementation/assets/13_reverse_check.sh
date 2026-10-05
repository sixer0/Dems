#!/bin/sh
# W13, AC-C-84 first clause: `npm run reverse -w @dems/mobile` maps tcp:4420. Session commands (NO_METRO=1).
set -u
echo "== $AVD_NAME $SERIAL $(date '+%H:%M:%S'); DEMS_CORE_HOST_PORT=${DEMS_CORE_HOST_PORT:-<unset>}"
echo "-- rules at command start (the helper's own tcp:4400 only)"
adb -s "$SERIAL" reverse --list | tr -d '\r'
echo "-- npm run reverse -w @dems/mobile (plain adb; ANDROID_SERIAL=$ANDROID_SERIAL picks the device)"
( cd "$ROOT" && npm run reverse -w @dems/mobile ) 2>&1 | grep -v "trust settings"
echo "-- rules after npm run reverse"
adb -s "$SERIAL" reverse --list | tr -d '\r'
echo "-- remove the two rules this command added (tcp:8081, tcp:4420); tcp:4400 is the helper's and goes at session end"
adb -s "$SERIAL" reverse --remove tcp:8081
adb -s "$SERIAL" reverse --remove tcp:4420
adb -s "$SERIAL" reverse --list | tr -d '\r'
echo "== end $(date '+%H:%M:%S')"
