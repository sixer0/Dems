#!/bin/sh
# W14 (step 36), npm slot N2. Run from the repository root, never from a subfolder:
#   /usr/bin/lockf -k -t 3600 .locks/npm.lock /bin/sh <this file> <raw-output-file>
# The two manifests were edited by hand before this script runs (qrcode.react 4.2.0 in
# apps/core-web/package.json, react 19.2.3 in apps/core-server/package.json). This script
# runs ONE `npm install --ignore-scripts`, no `npm install <pkg>` form, and approves no script.
RAW="$1"
ts() { date '+%Y-%m-%d %H:%M:%S %Z'; }
echo "== npm slot N2 acquired $(ts)"
echo "== INSTALL_START $(ts)"
npm install --ignore-scripts > "$RAW" 2>&1
rc=$?
echo "== INSTALL_END $(ts) exit(npm install)=$rc"
grep -v "failed to copy trust settings" "$RAW"
echo "== npm slot N2 released $(ts)"
exit $rc
