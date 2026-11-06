#!/bin/bash
# Hardware acceptance, check 9A/H-04 (chapter 2): a missing prerequisite is named at start;
# restored, none is named.
#   --boot-log FILE (four times, in the order of steps .1, .2, .3, .4) [--sudo-reads FILE]
# Step .5: from the four boot logs, the last line of each with its check name and code, and
# whether a listener of the Core existed 5 s after each start. The starts, the deleted and the
# restored loopback table are the USER's steps; this collector starts nothing.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h04.sh
HW_CHECK='9A/H-04'
HW_CHAPTER=2
HW_MODES=''
HW_ACCEPTS='boot-log sudo-reads'
HW_SUMMARY='the end of four boot logs: check name, code, refused or started (step .5)'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"

criterion 'Case 1: named 1 of 1, with exactly that prerequisite and no other; after restoring, named 0. Case 2: outcome (i) with named 1 of 1 and, after restoring, named 0; or outcome (ii), recorded, in which case the result of case 2 is taken from 9A/H-16 steps .9 and .10 and this check passes on case 1 alone.'
step '9A/H-04.5' SCRIPT 'from the four boot logs, the last line of each with its check name and code, and whether a listener of the Core existed 5 s after each start'
expected '.1 refused, names the worker program with CAPTURE_WORKER_PROGRAM_UNUSABLE (to confirm: or CAPTURE_WORKER_NOT_CONFIGURED), no listener; .2 capture fence passed; .3 refused naming the loopback rule, or the Core starts; .4 capture fence passed.'
n=0
for log in "$HW_BOOT_LOG_1" "$HW_BOOT_LOG_2" "$HW_BOOT_LOG_3" "$HW_BOOT_LOG_4"; do
  n=$((n + 1))
  hw_line "   -- boot log of step 9A/H-04.$n"
  if [ "$HW_DRY" = 1 ]; then
    hw_line '   would-read: the last line (level, check, code, reason: codes only), and the counts of "capture fence passed" and "the server stopped: boot"'
    continue
  fi
  if [ -z "$log" ]; then
    HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
    hw_line "   NOT HANDED OVER: the boot log of step .$n (--boot-log, the ${n}th); its reading is missing"
    continue
  fi
  HW_READ_COUNT=$((HW_READ_COUNT + 1))
  # shellcheck disable=SC2016
  awk "$HW_AWK_JSON"'
    { last = $0; if (index($0, "capture fence passed") > 0) passed++; if (index($0, "the server stopped: boot") > 0) stopped++
      if (index($0, "the server stopped") > 0 || index($0, "\"level\":60") > 0 || index($0, "\"level\":\"fatal\"") > 0) fatal = $0 }
    END {
      print "lines: " NR "; lines with \"capture fence passed\": " passed + 0 "; lines with \"the server stopped: boot\": " stopped + 0
      print "operation printed with the fence: " safe(jget(passedline, "operation"))
      if (fatal != "") print "the fatal line: check=" safe(jget(fatal, "check")) " code=" safe(jget(fatal, "code")) " reason=" safe(jget(fatal, "reason")) " checkId=" safe(jget(fatal, "checkId"))
      else print "the fatal line: none"
      print "the last line: level=" safe(jget(last, "level")) " code=" safe(jget(last, "code")) " check=" safe(jget(last, "check"))
    }
    index($0, "capture fence passed") > 0 { passedline = $0 }' "$log" | while IFS= read -r line; do hw_line "      step .$n | $line"; done
  hw_count "step .$n" "$log" CAPTURE_WORKER_PROGRAM_UNUSABLE CAPTURE_WORKER_NOT_CONFIGURED
done
confirm 'the field names of the fatal boot line (check, code, reason) and the code that names the loopback rule; a field printed "(absent)" is read by the USER from the log'
hw_handed 'listeners 5 s after each start' "$HW_SUDO_READS" 'after each of the four starts, 5 s later: sudo ss -H -ltnp | grep -c <service-user>   (a count per start, four lines, into one file for --sudo-reads)'
note 'what to record (part 6): per step the code named or "none"; the outcome letter of case 2; this file name.'
hw_done
