#!/bin/sh
# Applies the repository's source patches to installed libraries (decision D247, note 178).
#
#   apps/mobile/scripts/apply-patches.sh           apply (idempotent); run by the root "postinstall"
#   apps/mobile/scripts/apply-patches.sh --check   change nothing; exit 0 only when the patch is applied
#
# One patch today: apps/mobile/patches/react-native-reanimated+4.5.1.patch (Android: a synchronous props
# update for a view tag without a mounted view is skipped instead of building and logging an exception
# with a stack on the UI thread). It is a unified diff applied with the system `patch` tool: no
# dependency is installed for it. The Android build refuses to run without it
# (apps/mobile/plugins/with-dems-library-patches.js). To drop it: see apps/mobile/patches/README.md.
set -eu

LIB_NAME="react-native-reanimated"
LIB_VERSION="4.5.1"
MARKER="DEMS-PATCH react-native-reanimated+4.5.1"
MARKED_FILE="android/src/main/java/com/swmansion/reanimated/NativeProxy.kt"

MOBILE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$MOBILE_DIR/../.." && pwd)"
PATCH_FILE="$MOBILE_DIR/patches/$LIB_NAME+$LIB_VERSION.patch"
MODE="${1:-apply}"

fail() { echo "apply-patches: ERROR: $*" >&2; exit 1; }

case "$MODE" in apply|--check) ;; *) fail "unknown argument '$MODE' (use no argument or --check)." ;; esac
[ -f "$PATCH_FILE" ] || fail "the patch file $PATCH_FILE is missing."

LIB_DIR=""
for d in "$MOBILE_DIR/node_modules/$LIB_NAME" "$ROOT/node_modules/$LIB_NAME"; do
  if [ -f "$d/package.json" ]; then LIB_DIR="$d"; break; fi
done
if [ -z "$LIB_DIR" ]; then
  [ "$MODE" = "--check" ] && fail "$LIB_NAME is not installed: nothing to check."
  echo "apply-patches: $LIB_NAME is not installed here (an install without the mobile app): nothing to patch."
  exit 0
fi

INSTALLED="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$LIB_DIR/package.json" | head -n 1)"
[ "$INSTALLED" = "$LIB_VERSION" ] || fail "$LIB_NAME is version '$INSTALLED', and the patch is for exactly $LIB_VERSION. Do not build: read apps/mobile/patches/README.md (check whether the new version still needs the patch, then re-make or remove it)."

command -v patch >/dev/null 2>&1 || fail "the system 'patch' tool was not found."

if grep -q "$MARKER" "$LIB_DIR/$MARKED_FILE"; then
  # The marker is there: the whole patch must reverse cleanly, or the file is neither original nor patched.
  if patch -p1 -R -f -s --dry-run -d "$LIB_DIR" < "$PATCH_FILE" >/dev/null 2>&1; then
    echo "apply-patches: $LIB_NAME $LIB_VERSION is already patched: nothing to do."
    exit 0
  fi
  fail "$LIB_NAME $LIB_VERSION carries the patch marker but differs from the patched source. Reinstall the library (npm ci) and run this script again."
fi

[ "$MODE" = "--check" ] && fail "$LIB_NAME $LIB_VERSION is NOT patched. Run apps/mobile/scripts/apply-patches.sh; an unpatched library must not be packaged."

patch -p1 -N -f -s --dry-run -d "$LIB_DIR" < "$PATCH_FILE" >/dev/null 2>&1 \
  || fail "a hunk of $PATCH_FILE does not apply to $LIB_DIR. The library source is not the $LIB_VERSION this patch was made for; nothing was changed."
patch -p1 -N -f -s -d "$LIB_DIR" < "$PATCH_FILE" || fail "patch failed while writing; reinstall the library (npm ci) and run this script again."
rm -f "$LIB_DIR/$MARKED_FILE.orig" "$LIB_DIR/$MARKED_FILE.rej"
grep -q "$MARKER" "$LIB_DIR/$MARKED_FILE" || fail "the patch was applied but its marker is absent: the patch file lost its marker line."
echo "apply-patches: patched $LIB_NAME $LIB_VERSION ($MARKED_FILE)."
