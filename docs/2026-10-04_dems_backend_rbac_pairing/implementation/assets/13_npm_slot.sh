#!/bin/sh
# W13 npm slot N3. Runs inside /usr/bin/lockf -k -t 3600 .locks/npm.lock, from the workspace root.
set -u
S=$1
echo "== npm slot N3 acquired $(date '+%H:%M:%S')"
node "$S/edit-manifest.mjs" || { echo "manifest edit failed"; exit 2; }
echo "== dry run $(date '+%H:%M:%S')"
npm install --ignore-scripts --dry-run 2>&1 | tail -15
echo "dry-run exit=$?"
echo "== INSTALL_START $(date '+%H:%M:%S')"
npm install --ignore-scripts 2>&1
st=$?
echo "== INSTALL_END $(date '+%H:%M:%S') exit=$st"
echo "== npm slot N3 released $(date '+%H:%M:%S')"
exit $st
