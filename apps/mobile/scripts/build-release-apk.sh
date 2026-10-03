#!/usr/bin/env bash
# Builds the DEMO-signed Android release APK (06_packaging_spec §2.1, §2.8; step 94).
#
#   apps/mobile/scripts/build-release-apk.sh
#
# Run it OUTSIDE the sandbox (prebuild fetches the template from the npm registry; Gradle may fetch
# Maven artifacts; D14, D24). It never runs `prebuild --clean` (the debug APK must survive, D78),
# never installs anything on a device, and holds .locks/gradle.lock (P2) for prebuild + Gradle.
#
# Output (git-ignored): release/android/DEMS-Demo-<versionName>.apk, .apk.sha256, SHA256SUMS.txt,
# BUILD-INFO.txt. No password is ever printed: Gradle reads it from the git-ignored properties file.
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$MOBILE_DIR/../.." && pwd)"
OUT_DIR="$ROOT/release/android"
ABIS="arm64-v8a,armeabi-v7a,x86_64"   # 06 §2.3: no x86; set by flag, gradle.properties untouched

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export EXPO_NO_TELEMETRY=1
BT="$ANDROID_HOME/build-tools/36.0.0"

ts() { TZ=Asia/Jakarta date '+%Y-%m-%d %H:%M:%S WIB'; }
fail() { echo "build-release-apk: $*" >&2; exit 1; }

# --- A. Preflight -------------------------------------------------------------------------------
[[ -f "$MOBILE_DIR/signing/release-signing.properties" && -f "$MOBILE_DIR/signing/dems-demo-release.p12" ]] \
  || fail "signing material missing: run apps/mobile/scripts/create-demo-keystore.sh once."
git -C "$ROOT" check-ignore -q release/x || fail "release/ is not git-ignored."
git -C "$ROOT" check-ignore -q apps/mobile/signing/x || fail "apps/mobile/signing/ is not git-ignored."
VERSION_NAME="$(node -p "require('$MOBILE_DIR/app.json').expo.version")"
VERSION_CODE="$(node -p "require('$MOBILE_DIR/app.json').expo.android.versionCode")"
[[ "$VERSION_CODE" == "100" ]] || echo "build-release-apk: note: versionCode is $VERSION_CODE"
node -e "process.exit(require('$MOBILE_DIR/app.json').expo.plugins.includes('./plugins/with-dems-release-signing')?0:1)" \
  || fail "app.json plugins lacks ./plugins/with-dems-release-signing."
APK_NAME="DEMS-Demo-$VERSION_NAME.apk"
START="$(ts)"
echo "build-release-apk: start $START (versionName $VERSION_NAME, versionCode $VERSION_CODE, ABIs $ABIS)"

# --- B + C. prebuild + assembleRelease under the Gradle lock -------------------------------------
mkdir -p "$ROOT/.locks"
/usr/bin/lockf -k -t 3600 "$ROOT/.locks/gradle.lock" /bin/bash -c '
  set -euo pipefail
  cd "$1"
  npx expo prebuild --platform android --no-install
  n=$(grep -c "@dems-release-signing" android/app/build.gradle || true)
  [[ "$n" == "1" ]] || { echo "build-release-apk: signing marker count is $n (expected 1)" >&2; exit 1; }
  cd android
  ./gradlew --no-daemon assembleRelease -PreactNativeArchitectures="$2"
' _ "$MOBILE_DIR" "$ABIS"

SRC_APK="$MOBILE_DIR/android/app/build/outputs/apk/release/app-release.apk"
[[ -f "$SRC_APK" ]] || fail "Gradle reported success but $SRC_APK is missing."

# --- D. Copy, checksums, build info --------------------------------------------------------------
mkdir -p "$OUT_DIR"
cp -f "$SRC_APK" "$OUT_DIR/$APK_NAME"
cd "$OUT_DIR"
SUM_LINE="$(shasum -a 256 "$APK_NAME")"
echo "$SUM_LINE" > "$APK_NAME.sha256"
echo "$SUM_LINE" > SHA256SUMS.txt
shasum -a 256 -c SHA256SUMS.txt

SIZE="$(stat -f %z "$APK_NAME")"
CERTS="$("$BT/apksigner" verify --verbose --print-certs "$APK_NAME")"
BADGING="$("$BT/aapt2" dump badging "$APK_NAME")"
END="$(ts)"
{
  echo "DEMS Demo Android release - BUILD-INFO (06_packaging_spec §2.8)"
  echo "file:            $APK_NAME"
  echo "size_bytes:      $SIZE"
  echo "sha256:          ${SUM_LINE%% *}"
  echo "versionName:     $VERSION_NAME"
  echo "versionCode:     $VERSION_CODE"
  echo "package:         $(grep -o "package: name='[^']*'" <<<"$BADGING" | cut -d"'" -f2)"
  echo "native-code:     $(grep '^native-code:' <<<"$BADGING" | cut -d: -f2- | xargs)"
  echo "sdk:             min $(grep -o "^minSdkVersion:'[0-9]*'" <<<"$BADGING" | cut -d"'" -f2), target $(grep -o "^targetSdkVersion:'[0-9]*'" <<<"$BADGING" | cut -d"'" -f2)"
  echo "signer_dn:       $(grep -m1 'certificate DN:' <<<"$CERTS" | sed 's/.*certificate DN: //')"
  echo "signer_sha256:   $(grep -m1 'certificate SHA-256 digest:' <<<"$CERTS" | sed 's/.*digest: //')"
  echo "schemes:         $(grep -E '^Verified using v[0-9].*: true' <<<"$CERTS" | sed -E 's/Verified using (v[0-9.]+) scheme.*/\1/' | xargs)"
  echo "expo:            $(node -p "require('$ROOT/node_modules/expo/package.json').version")"
  echo "react-native:    $(node -p "require('$ROOT/node_modules/react-native/package.json').version")"
  echo "hermes:          bundled with react-native (hermesEnabled=true)"
  echo "jdk:             $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
  echo "agp/gradle:      AGP $(grep -o 'agp = "[^"]*"' "$ROOT/node_modules/react-native/gradle/libs.versions.toml" | cut -d'"' -f2), Gradle $(grep -o 'gradle-[0-9.]*-' "$MOBILE_DIR/android/gradle/wrapper/gradle-wrapper.properties" | sed 's/gradle-//;s/-$//')"
  echo "git_head:        $(git -C "$ROOT" rev-parse HEAD) (dirty files: $(git -C "$ROOT" status --porcelain | wc -l | xargs))"
  echo "demo_data_as_of: default (no --as-of re-dating; demo-alignment joins on sequence, D84)"
  echo "build_start:     $START"
  echo "build_end:       $END"
  echo "signing:         DEMO key only - not a production identity"
} > BUILD-INFO.txt
echo "build-release-apk: done $END -> release/android/$APK_NAME ($SIZE bytes)"
