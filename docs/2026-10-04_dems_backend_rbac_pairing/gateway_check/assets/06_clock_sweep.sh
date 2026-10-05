#!/bin/sh
# Asset of plan row W58 (gateway_check/06_backend_gate.md) — item C, the shifted-clock sweep (D31).
# Recipe recorded by controller row W01b in implementation/01b_calendar_sweep.md §12, unchanged:
#   DEMS_FAKE_NOW=<instant> NODE_OPTIONS="--import $W/fake-clock.mjs" npm run test -w <ws> -- --maxWorkers=2
#   (mobile needs the extra jest setup file, passed LAST).
# Scratch helpers live in the git-ignored .cache/w01b/ (they are not part of the repository).
#
# Usage:  sh 06_clock_sweep.sh <label> <instant>
# Logs:   gateway_check/assets/06_c_<label>_<suite>.log
# Exit:   0 when all three suites exited 0; otherwise the number of suites that did not.

W=/Users/gsp-budi/Documents/DEMS/.cache/w01b
OUT=/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/assets
LABEL="$1"
INSTANT="$2"
fails=0

run() {
  suite="$1"; shift
  log="$OUT/06_c_${LABEL}_${suite}.log"
  {
    echo "# suite=$suite instant=$INSTANT"
    date '+start %Y-%m-%d %H:%M:%S'
  } > "$log"
  if "$@" >> "$log" 2>&1; then code=0; else code=1; fi
  {
    echo "EXIT=$code"
    date '+stop  %Y-%m-%d %H:%M:%S'
  } >> "$log"
  grep -E 'Test Files|Tests +[0-9]|Suites|snapshot' "$log" | tail -n 6
  echo "-- $suite exit=$code  (log $(basename "$log"))"
  fails=$((fails + code))
}

echo "== label=$LABEL instant=$INSTANT =="

run web env DEMS_FAKE_NOW="$INSTANT" NODE_OPTIONS="--import $W/fake-clock.mjs" \
  npm run test -w @dems/core-web -- --maxWorkers=2

run shared env DEMS_FAKE_NOW="$INSTANT" NODE_OPTIONS="--import $W/fake-clock.mjs" \
  npm run test -w @dems/shared -- --maxWorkers=2

run mobile env DEMS_FAKE_NOW="$INSTANT" NODE_OPTIONS="--import $W/fake-clock.mjs" \
  npm run test -w @dems/mobile -- --maxWorkers=2 --setupFiles "$W/fake-clock-jest-setup.js"

echo "== label=$LABEL suites that did not exit 0: $fails =="
exit "$fails"
