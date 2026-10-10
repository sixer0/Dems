#!/bin/sh
# The kill matrix of M7 (blueprint row 86), one named check at a time. Run from the repository root.
#
#   run.sh --list                 the 35 checks and the 10 parked ones, nothing is started
#   run.sh --only M7-KM-P2-S3     that check, ONCE (decision D122)
#   run.sh --only M7-REF-1 --only M7-KM-P1-0     each named check once, one after the other
#
# There is no "all" and no repeat count. Each run holds the heavy-host lock (it starts the built
# capture worker; loopback only, 127.0.0.1:8554 and 8556) and the db lock (throw-away databases
# on the project PostgreSQL). It reads no `.data/pg*.env`, opens no camera and no microphone.
# PostgreSQL and the loopback ports need the Bash sandbox off.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../../../../../.." && pwd)
file=src/sealing/__tests__/kill-matrix/kill-matrix.db.test.ts
ids=
while [ $# -gt 0 ]; do
  case "$1" in
    --list)
      exec "$root/node_modules/.bin/tsx" -e "import('$root/apps/core-server/src/sealing/__tests__/kill-matrix/cells.ts').then((m) => { for (const c of m.KILL_MATRIX) console.log(c.id + '\t' + (c.kills.join(' -> ') || 'no kill') + '\t' + c.expectation); for (const p of m.PARKED_CELLS) console.log(p.id + '\tPARKED\t' + p.condition); })"
      ;;
    --only)
      [ $# -ge 2 ] || { echo "--only needs a check ID" >&2; exit 2; }
      ids="${ids:+$ids,}$2"
      shift 2
      ;;
    *)
      echo "unknown argument: $1 (use --list or --only <id>)" >&2
      exit 2
      ;;
  esac
done
[ -n "$ids" ] || { echo "name a check: --only <id> (see --list)" >&2; exit 2; }
[ -x "$root/apps/capture-worker/build/capture-worker" ] || { echo "the capture worker is not built (make -C apps/capture-worker)" >&2; exit 2; }
[ -x "$root/.data/helpers/ffmpeg" ] || { echo "the development helper is missing (npm run capture:dev-setup)" >&2; exit 2; }
DEMS_KILL_MATRIX="$ids" exec /usr/bin/lockf -k -t 1800 "$root/.locks/heavy-host.lock" /usr/bin/lockf -k "$root/.locks/db-migrate.lock" \
  "$root/node_modules/.bin/vitest" run --root "$root/apps/core-server" --project db --maxWorkers=1 "$file"
