#!/bin/sh
# `npm run test:kill-matrix`: every ACTIVE cell of the M7 kill matrix, once, in ONE call of the
# matrix runner (the parked cells are not started). The cell list is read from the runner itself
# (`run.sh --list`), so this file holds no cell id. The runner checks that the capture worker is
# built and the development helper is present, takes the heavy-host lock and the db lock, and
# sets DEMS_KILL_MATRIX. Loopback ports and PostgreSQL: the Bash sandbox must be off.
# Run from the repository root (npm does). About 10 minutes on a quiet host.
set -eu
run=apps/core-server/src/sealing/__tests__/kill-matrix/run.sh
list=$(sh "$run" --list)
only=$(printf '%s\n' "$list" | awk -F'\t' '$2 != "PARKED" { printf "--only %s ", $1 }')
[ -n "$only" ] || { echo "test:kill-matrix: the runner listed no active cell" >&2; exit 2; }
# shellcheck disable=SC2086
exec sh "$run" $only
