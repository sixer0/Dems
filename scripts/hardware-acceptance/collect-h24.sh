#!/bin/bash
# Hardware acceptance, check 9A/H-24 (chapter 2): no leftover after the kill; a planted leftover
# is named at the next start.
#   --tools      step .1: whether /bin/ps and /usr/bin/readlink exist; the output form of
#                ps -axo pid=,comm= and ps -axo pid=,args= for the collector's own process (HOST-17)
# Steps .2 to .5 (starting the Core, planting and ending a process) are the USER's.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h24.sh
HW_CHECK='9A/H-24'
HW_CHAPTER=2
HW_MODES='tools'
HW_ACCEPTS=''
HW_SUMMARY='the two tools of the leftover check and the form of the process listing (step .1)'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"

criterion 'Leftovers named after the kill of 9A/H-02: 0. Planted leftover named: 1 of 1, with the planted process id. After its removal: 0 named.'
step '9A/H-24.1' SCRIPT 'whether /bin/ps and /usr/bin/readlink exist; the output form of ps -axo pid=,comm= and ps -axo pid=,args= for the collector'"'"'s own process'
expected 'both tools exist; comm= prints a name of at most 15 characters, args= the full path.'
for tool in /bin/ps /usr/bin/readlink; do
  if [ "$HW_DRY" = 1 ]; then
    hw_line "   would-test: $tool exists and is executable"
  elif [ -x "$HW_ROOT$tool" ]; then
    obs "$tool exists and is executable" yes
  else
    obs "$tool exists and is executable" no
  fi
done
hw_read_quiet 'short names' ps -axo pid=,comm=
# shellcheck disable=SC2016
hw_reduce '{ n = length($2); if (n > max) max = n; if ($1 == me) mine = $2 " (" n " characters)" } END { print "longest short name: " (max + 0) " characters; this collector: " (mine == "" ? "not found in the listing" : mine) }' -v me="$$"
obs 'ps -axo pid=,comm=' "$HW_RED"
hw_read_quiet 'full command lines' ps -axo pid=,args=
# shellcheck disable=SC2016
hw_reduce '$1 == me { first = $2; print (substr(first, 1, 1) == "/" ? "an absolute path" : "not an absolute path") " (first word of this collector'"'"'s own line)"; found = 1 } END { if (!found) print "this collector was not found in the listing" }' -v me="$$"
obs 'ps -axo pid=,args=' "$HW_RED"
step '9A/H-24.2 to .5' USER 'the three starts of the development-capture Core, the planted process and its removal'
user_step 'read each boot log for a named leftover: expected 0 at step .2, 1 with the planted process id at step .4, 0 at step .5; note refusal or warning and its code at step .4'
note 'what to record (part 6): the two tool lines; named at step .2, .4, .5; refusal or warning at .4 with its code; this file name.'
hw_done
