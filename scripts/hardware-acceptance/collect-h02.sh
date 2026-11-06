#!/bin/bash
# Hardware acceptance, check 9A/H-02 (chapter 2): no child process outlives a Core that is ended
# abruptly.
#   --before --core-pid N                      step .2: the Core's descendants and the camera listeners
#   --after --at 10|60 --before-file FILE      step .4: which of the listed process ids still exist
# The kill itself (step .3, sudo kill -KILL) is the USER's. This collector sends no signal.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h02.sh
HW_CHECK='9A/H-02'
HW_CHAPTER=2
HW_MODES='before after'
HW_ACCEPTS='core-pid at before-file install-dir data-dir service-user'
HW_SUMMARY='the descendants of the Core before the kill; which of them exist 10 s and 60 s after it'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"

criterion 'Surviving child processes at 10 s: 0. Listeners on ports 8554 to 8564 at 10 s: 0. Ended by: the product'"'"'s own rule (the Core did not run under the service unit).'

listeners() {
  hw_read_quiet 'listening TCP sockets' ss -H -ltn
  # shellcheck disable=SC2016
  hw_reduce '{ n = split($4, part, ":"); port = part[n] + 0; if (port >= 8554 && port <= 8564) { c++; if ($4 !~ /^127\./) other++ } } END { print (c + 0) " (not on a loopback address: " (other + 0) ")" }'
  obs 'listeners on ports 8554 to 8564' "$HW_RED"
}

case "$HW_MODE" in
  before)
    step '9A/H-02.2' SCRIPT 'the Core'"'"'s process id; every descendant of it with process id, short name and program path; the listeners on 127.0.0.1 ports 8554 to 8564'
    expected 'at least 2 descendants (the worker and at least one helper); 2 listeners.'
    if [ -z "$HW_CORE_PID" ] && [ "$HW_DRY" != 1 ]; then hw_fail 2 'refused: --before needs --core-pid. Nothing more was read.'; fi
    hw_read_quiet 'process table' ps -eo pid=,ppid=,comm=
    # shellcheck disable=SC2016
    hw_reduce '
      { pid[NR] = $1; parent[$1] = $2; name[$1] = $3 }
      END {
        want[core] = 1; changed = 1
        while (changed) { changed = 0; for (i = 1; i <= NR; i++) if (!(pid[i] in want) && (parent[pid[i]] in want)) { want[pid[i]] = 1; changed = 1 } }
        for (i = 1; i <= NR; i++) if ((pid[i] in want) && pid[i] != core) print pid[i], name[pid[i]]
      }' -v core="${HW_CORE_PID:-0}"
    if [ "$HW_DRY" = 1 ]; then
      hw_line '   would-list: one line "LISTED <pid> <short name>" per descendant, and its program path from readlink /proc/<pid>/exe'
    else
      count=0
      while read -r pid name; do
        [ -n "$pid" ] || continue
        count=$((count + 1))
        hw_line "   LISTED $pid $name"
        hw_read "program path of $pid" readlink "$HW_ROOT/proc/$pid/exe"
      done <<LIST
$HW_RED
LIST
      obs 'descendants of the Core' "$count"
      obs 'the Core process id (for step .3, the USER'"'"'s kill)' "$HW_CORE_PID"
    fi
    listeners
    user_step '9A/H-02.3: sudo kill -KILL <core-pid>; note the host clock. Then this collector with --after --at 10, and again --at 60, each with --before-file <this file>.'
    ;;
  after)
    step '9A/H-02.4' SCRIPT 'which of the process ids of step .2 still exist; the listeners on ports 8554 to 8564'
    expected 'at 10 s: 0 of the listed process ids exist, 0 listeners. At 60 s: the same.'
    if [ "$HW_DRY" != 1 ]; then
      [ -n "$HW_BEFORE_FILE" ] || hw_fail 2 'refused: --after needs --before-file (the output of --before). Nothing more was read.'
      [ -n "$HW_AT" ] || hw_fail 2 'refused: --after needs --at 10 or --at 60 (seconds after the kill; the USER times it). Nothing more was read.'
    fi
    note "this reading is labelled ${HW_AT:-<n>} s after the kill by the USER; the collector does not wait and does not know when the kill was"
    hw_read_quiet 'process table' ps -eo pid=,comm=
    if [ "$HW_DRY" = 1 ]; then
      hw_line '   would-compare: every "LISTED <pid> <short name>" line of --before-file against the process table'
    else
      # shellcheck disable=SC2016
      listed=$(awk '$1 == "LISTED" { print $2, $3 }' "$HW_BEFORE_FILE")
      alive=0
      reused=0
      total=0
      while read -r pid name; do
        [ -n "$pid" ] || continue
        total=$((total + 1))
        # shellcheck disable=SC2016
        hw_reduce '$1 == p { print $2 }' -v p="$pid"
        if [ -z "$HW_RED" ]; then
          hw_line "   GONE     $pid $name"
        elif [ "$HW_RED" = "$name" ]; then
          alive=$((alive + 1))
          hw_line "   SURVIVES $pid $name"
        else
          reused=$((reused + 1))
          hw_line "   REUSED   $pid (now another program; the listed $name is gone)"
        fi
      done <<LIST
$listed
LIST
      obs 'process ids listed before the kill' "$total"
      obs "of them existing at ${HW_AT} s with the same short name (survivors)" "$alive"
      obs 'process ids now held by another program' "$reused"
    fi
    listeners
    ;;
esac
note 'what to record (part 6): descendants before (count, short names), survivors at 10 s and at 60 s (count, short names), the two file names.'
hw_done
