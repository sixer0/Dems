#!/bin/bash
# Hardware acceptance, check 9A/H-06 (chapter 2): a temporary address is added, refused on
# conflict, and removed after its lifetime with the Core killed.
#   --state --camera-interface IF [--core-pid N] [--at LABEL] [--sudo-reads FILE]   steps .2, .3, .4, .5, .7
#   --audit --audit-file FILE                                                              step .9
# --at is a label of the reading (for step .7: 330, the seconds after the add of step .5; the USER
# times it, the collector does not wait). Adding, removing and killing are steps of TECH and USER.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h06.sh
HW_CHECK='9A/H-06'
HW_CHAPTER=2
HW_MODES='state audit'
HW_ACCEPTS='camera-interface core-pid at sudo-reads audit-file'
HW_SUMMARY='addresses and their lifetimes on the camera port, the helper'"'"'s marks, NoNewPrivs; the audit entries of the temporary address'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"

criterion '1. added: 2 of 2 (steps .1, .5), each with a valid_lft not above its lifetime in seconds; 2. removed on request: 1 of 1; 3. conflict refused: 1 of 1, address not added; 4. with the Core killed, the address is absent at 330 s: 1 of 1 (hypothesis H-S holds); 5. after the restart, temporary-address rows still open: 0; entries HOST_ALIAS_REMOVE_FAILED: 0; actions without an audit entry: 0.'
case "$HW_MODE" in
  state)
    step '9A/H-06.2 (.3, .4, .5, .7)' SCRIPT 'ip -4 addr show dev <camera-interface> reduced to the count of addresses and the valid_lft figure of each; the count of files under /run/dems-core-netalias/marks; NoNewPrivs of the Core'"'"'s process'
    expected '.2: 2 addresses, the second with valid_lft at most 1800; 1 mark file; NoNewPrivs: 1. .3: 1 address; 0 mark files. .4: 1 address; 0 mark files. .5: 2 addresses, the second with valid_lft at most 300. .7 (330 s after the add, Core killed): 1 address.'
    if [ "$HW_DRY" != 1 ] && [ -z "$HW_CAMERA_INTERFACE" ]; then hw_fail 2 'refused: --state needs --camera-interface. Nothing more was read.'; fi
    if [ -n "$HW_AT" ]; then note "this reading is labelled $HW_AT by the USER (for step .7: seconds after the add of step .5)"; fi
    hw_read_quiet 'addresses on the camera port' ip -4 addr show dev "${HW_CAMERA_INTERFACE:-<camera-interface>}"
    # shellcheck disable=SC2016
    hw_reduce '$1 == "inet" { c++ } $1 == "valid_lft" { life = life " " $2 } END { print (c + 0) "; valid_lft of each:" (life == "" ? " (none)" : life) }'
    obs 'addresses on the camera port' "$HW_RED"
    if [ "$HW_DRY" = 1 ]; then
      hw_line '   would-count: the files under /run/dems-core-netalias/marks (their names are addresses and are not printed)'
    elif [ -d "$HW_ROOT/run/dems-core-netalias/marks" ] && [ -r "$HW_ROOT/run/dems-core-netalias/marks" ]; then
      HW_READ_COUNT=$((HW_READ_COUNT + 1))
      marks=0
      for f in "$HW_ROOT/run/dems-core-netalias/marks"/*; do
        if [ -e "$f" ]; then marks=$((marks + 1)); fi
      done
      obs 'mark files of the helper' "$marks"
    else
      user_step 'sudo find /run/dems-core-netalias/marks -type f | wc -l     (prints one number; into the file for --sudo-reads)'
      hw_handed 'mark files of the helper (the folder is not readable by this account)' "$HW_SUDO_READS" 'pass the file with --sudo-reads'
    fi
    if [ -n "$HW_CORE_PID" ] || [ "$HW_DRY" = 1 ]; then
      hw_proc_lines 'NoNewPrivs of the Core (HOST-38)' "${HW_CORE_PID:-<core-pid>}" status '^NoNewPrivs:'
    else
      note 'no --core-pid given: NoNewPrivs is not read (after step .6 no Core runs, and that is the expected state)'
    fi
    ;;
  audit)
    step '9A/H-06.9' SCRIPT 'from the audit list, the count of entries of the types HOST_ALIAS_ADDED, HOST_ALIAS_REMOVED and HOST_ALIAS_REMOVE_FAILED since step .1, in order, each with its reason code; no address is printed'
    expected 'entries in this order: added (.1), removed (.3), the conflict of .4 as the development'"'"'s record states it, added (.5), removed at the start of .8. HOST_ALIAS_REMOVE_FAILED: 0.'
    user_step 'save the audit list since step .1 as a text file, one entry per line (the export of the web console, or its lines copied), and pass it with --audit-file'
    if hw_log_needed --audit-file "$HW_AUDIT"; then
      hw_count 'audit list' "${HW_AUDIT:-<audit>}" HOST_ALIAS_ADDED HOST_ALIAS_REMOVED HOST_ALIAS_REMOVE_FAILED
      if [ "$HW_DRY" = 1 ]; then
        hw_line '   would-list: the three types in the order of the file, each with its reason code (reason, reasonCode or code); no address'
      else
        HW_READ_COUNT=$((HW_READ_COUNT + 1))
        # shellcheck disable=SC2016
        awk "$HW_AWK_JSON"'
          { t = ""; if (index($0, "HOST_ALIAS_REMOVE_FAILED")) t = "HOST_ALIAS_REMOVE_FAILED"; else if (index($0, "HOST_ALIAS_REMOVED")) t = "HOST_ALIAS_REMOVED"; else if (index($0, "HOST_ALIAS_ADDED")) t = "HOST_ALIAS_ADDED" }
          t != "" { c++; r = jget($0, "reason"); if (r == "") r = jget($0, "reasonCode"); if (r == "") r = jget($0, "code"); print c ": " t " reason=" safe(r) " phase=" safe(jget($0, "phase")) }' "$HW_AUDIT" | while IFS= read -r line; do hw_line "      in order | $line"; done
      fi
      confirm 'the form of the saved audit list and the field that holds the reason code; the number of entries per action (intent and result) is the one the closing report states'
    fi
    ;;
esac
note 'what to record (part 6): the address counts of every reading; the two valid_lft figures; the time of the add and of the reading of .7; the closing reason of .8; the entry counts per type. Not: any address, the interface'"'"'s name.'
hw_done
