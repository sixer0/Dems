#!/bin/sh
# W13 Gradle slot. Runs inside /usr/bin/lockf -k -t 3600 .locks/gradle.lock, cwd = workspace root,
# environment of a login zsh (JDK 17, ANDROID_HOME). Debug variant only.
set -u
S=$1
ROOT=$(pwd)
AND="$ROOT/apps/mobile/android"
KS="$AND/app/debug.keystore"
BK="$ROOT/.cache/apk-backup"
APK="$AND/app/build/outputs/apk/debug/app-debug.apk"
EXPECT_KS="FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C"
EXPECT_APK="fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c"
ks_digest() { keytool -list -v -keystore "$1" -storepass android -alias androiddebugkey 2>/dev/null | sed -n 's/^[[:space:]]*SHA256: //p' | head -n 1; }
# Tracked files that prebuild could touch, without the folders other rows are writing (apps/mobile/src).
tracked_state() {
  GIT_OPTIONAL_LOCKS=0 git status --porcelain -- package.json package-lock.json apps/mobile ':!apps/mobile/src'
  GIT_OPTIONAL_LOCKS=0 git diff -- package.json package-lock.json apps/mobile ':!apps/mobile/src' | shasum -a 256
}

echo "== gradle.lock acquired $(date '+%H:%M:%S')"
echo "JAVA_HOME=$JAVA_HOME"; java -version 2>&1 | head -n 1
echo "ANDROID_HOME=$ANDROID_HOME"; echo "node=$(command -v node) $(node -v)"
echo "load: $(uptime | sed 's/.*load averages: //')"

echo "== before prebuild"
ls -la "$KS" "$APK" 2>&1
echo "keystore cert SHA256 (before prebuild): $(ks_digest "$KS")"
echo "keystore file sha256 (before prebuild): $(shasum -a 256 "$KS" | cut -d' ' -f1)"
ls -ld "$AND" "$AND/app/build" 2>&1
tracked_state >"$S/tracked.before"

echo "== PREBUILD_START $(date '+%H:%M:%S')"
EXPO_OFFLINE=1 npm run prebuild -w @dems/mobile 2>&1
pst=$?
echo "== PREBUILD_END $(date '+%H:%M:%S') exit=$pst"
[ "$pst" -eq 0 ] || { echo "ABORT: prebuild failed"; exit 2; }

tracked_state >"$S/tracked.after"
if cmp -s "$S/tracked.before" "$S/tracked.after"; then
  echo "tracked files outside apps/mobile/src: unchanged by prebuild"
  cat "$S/tracked.after"
else
  echo "ABORT: prebuild changed tracked files (rule 8). Before / after:"
  diff "$S/tracked.before" "$S/tracked.after"
  exit 3
fi
echo "git status of the generated folders (expect nothing: both are git-ignored):"
GIT_OPTIONAL_LOCKS=0 git status --porcelain -- apps/mobile/android apps/mobile/ios | head -n 5
echo "(end)"

echo "== after prebuild (KI-21)"
ls -ld "$AND" 2>&1
if [ -f "$APK" ]; then echo "old app-debug.apk: still present"; else echo "old app-debug.apk: GONE (android/ was cleared; the backup holds it)"; fi

echo "== KEYSTORE GUARD (F28, D26)"
if [ -f "$KS" ]; then
  now=$(ks_digest "$KS")
  echo "keystore after prebuild: present, file sha256 $(shasum -a 256 "$KS" | cut -d' ' -f1)"
  echo "keystore cert SHA256 (after prebuild):  $now"
else
  now=""
  echo "keystore after prebuild: MISSING"
fi
if [ "$now" = "$EXPECT_KS" ]; then
  echo "GUARD: digest equals the backed-up one; no restore needed"
else
  echo "GUARD: digest differs or file missing; restoring $BK/debug.keystore"
  cp -p "$BK/debug.keystore" "$KS" || { echo "ABORT: restore failed"; exit 4; }
  now=$(ks_digest "$KS")
  echo "keystore cert SHA256 (after restore):   $now"
  [ "$now" = "$EXPECT_KS" ] || { echo "ABORT: restored keystore has the wrong certificate"; exit 4; }
fi
grep -n "storeFile\|keyAlias\|signingConfig " "$AND/app/build.gradle" | head -n 12
grep -n "versionCode\|versionName" "$AND/app/build.gradle" | head -n 4

echo "== BUILD_START $(date '+%H:%M:%S') (assembleDebug only)"
t0=$(date +%s)
( cd "$AND" && ./gradlew assembleDebug ) >"$S/gradle_build.log" 2>&1
bst=$?
t1=$(date +%s)
echo "== BUILD_END $(date '+%H:%M:%S') exit=$bst duration=$((t1 - t0))s"
grep -E "BUILD (SUCCESSFUL|FAILED)|actionable tasks" "$S/gradle_build.log"
echo "load: $(uptime | sed 's/.*load averages: //')"
if [ "$bst" -ne 0 ]; then
  echo "ABORT: build failed; last lines:"; tail -n 60 "$S/gradle_build.log"
  ( cd "$AND" && ./gradlew --stop ) 2>&1 | tail -n 3
  exit 5
fi

echo "== APK"
ls -la "$APK"
echo "sha256: $(shasum -a 256 "$APK" | cut -d' ' -f1)"
AS=$(ls "$ANDROID_HOME"/build-tools/*/apksigner | sort | tail -n 1)
echo "apksigner: $AS"
"$AS" verify --print-certs "$APK" 2>&1 | grep -E "Signer #1 certificate (DN|SHA-256)|Verified using|DOES NOT VERIFY|ERROR" >"$S/apksigner.txt"
"$AS" verify --verbose "$APK" 2>&1 | grep -E "^Verifies|Verified using v[1-4]" >>"$S/apksigner.txt"
cat "$S/apksigner.txt"
got=$(sed -n 's/^Signer #1 certificate SHA-256 digest: //p' "$S/apksigner.txt" | head -n 1)
if [ "$got" = "$EXPECT_APK" ]; then echo "APK CERT: MATCH ($got)"; cst=0; else echo "APK CERT: MISMATCH (got '$got')"; cst=6; fi

echo "== stop the Gradle daemon this build started (P7)"
( cd "$AND" && ./gradlew --stop ) 2>&1 | tail -n 3
echo "== gradle.lock released $(date '+%H:%M:%S')"
exit $cst
