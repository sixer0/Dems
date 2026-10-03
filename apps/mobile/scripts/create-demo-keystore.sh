#!/usr/bin/env bash
# Creates the DEMO release keystore for the packaged Android APK (06_packaging_spec §2.2, step 94).
#
#   apps/mobile/signing/dems-demo-release.p12        PKCS12, alias dems-demo, mode 600
#   apps/mobile/signing/release-signing.properties   store/key password (random), mode 600
#
# Rules:
# - Refuses to run when either file already exists (rotation is a deliberate manual delete).
# - The password comes from `openssl rand -hex 16`, is passed to keytool through the environment
#   (never in process arguments), is written only to the git-ignored properties file and is never
#   echoed or logged.
# - Prints only the certificate SHA-256 fingerprint and the owner DN.
# - DEMO key only: it identifies the demo build, it is not a production signing identity.
set -euo pipefail
umask 077

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIGNING_DIR="$MOBILE_DIR/signing"
KEYSTORE="$SIGNING_DIR/dems-demo-release.p12"
PROPS="$SIGNING_DIR/release-signing.properties"
ALIAS="dems-demo"
DNAME="CN=DEMS Demo Release (DEMO ONLY - NOT FOR PRODUCTION), OU=Demo, O=DEMS Demo, C=ID"

JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
KEYTOOL="$JAVA_HOME/bin/keytool"

if [[ -e "$KEYSTORE" || -e "$PROPS" ]]; then
  echo "create-demo-keystore: refusing to overwrite existing signing material in apps/mobile/signing/." >&2
  echo "Delete both files by hand first if a rotation is really intended." >&2
  exit 1
fi
[[ -x "$KEYTOOL" ]] || { echo "create-demo-keystore: keytool not found at $KEYTOOL" >&2; exit 1; }

# The folder must be git-ignored before any key material lands in it (R45).
REPO_ROOT="$(cd "$MOBILE_DIR/../.." && pwd)"
if ! git -C "$REPO_ROOT" check-ignore -q apps/mobile/signing/x; then
  echo "create-demo-keystore: apps/mobile/signing/ is not git-ignored; aborting." >&2
  exit 1
fi

mkdir -p "$SIGNING_DIR"
chmod 700 "$SIGNING_DIR"

DEMS_KS_PASS="$(openssl rand -hex 16)"
export DEMS_KS_PASS

"$KEYTOOL" -genkeypair -storetype PKCS12 \
  -keystore "$KEYSTORE" -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "$DNAME" \
  -storepass:env DEMS_KS_PASS -keypass:env DEMS_KS_PASS >/dev/null 2>&1
chmod 600 "$KEYSTORE"

{
  echo "# DEMO release signing for the DEMS demo APK (06_packaging_spec §2.2). Git-ignored. Never commit or share."
  echo "storeFile=signing/dems-demo-release.p12"
  echo "storeType=pkcs12"
  echo "keyAlias=$ALIAS"
  echo "storePassword=$DEMS_KS_PASS"
  echo "keyPassword=$DEMS_KS_PASS"
} >"$PROPS"
chmod 600 "$PROPS"

# Only the fingerprint and the owner DN leave this script.
"$KEYTOOL" -list -v -keystore "$KEYSTORE" -alias "$ALIAS" -storepass:env DEMS_KS_PASS 2>/dev/null \
  | grep -E '^(Owner:|[[:space:]]*SHA256:)' | sed -E 's/^[[:space:]]+//'
unset DEMS_KS_PASS
echo "create-demo-keystore: created apps/mobile/signing/dems-demo-release.p12 and release-signing.properties (mode 600)."
