#!/bin/bash
# Hardware acceptance, check 9A/H-14 (chapter 3): the camera's address set from the console;
# found again by its hardware address.
#   --state --camera-interface IF [--hw-address-file FILE]                                   step .4
#   --audit --audit-file FILE --core-log FILE [--error-log FILE] --install-dir D             step .5
# --hw-address-file: a one-line file with the hardware address BENCH read from the label. It is
# compared with the host's neighbour table and never printed: the answer is "yes" or "no".
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h14.sh
HW_CHECK='9A/H-14'
HW_CHAPTER=3
HW_MODES='state audit'
HW_SESSION_MODES=''
HW_ACCEPTS='camera-interface hw-address-file audit-file core-log error-log install-dir'
HW_SUMMARY='addresses, marks and the neighbour entry after the job; the audit entries; the count-only scan'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'Same hardware address at the new address inside 180 s: the measured seconds are recorded. Audit entries for the change: 2, one per phase (at least 1; the count seen is recorded). Occurrences of a credential form in the log, the error log and the audit details: 0. Temporary addresses left: 0. The password field is not pre-filled: 2 of 2 readings.'
case "$HW_MODE" in
  state)
    step '9A/H-14.4' SCRIPT 'the count of addresses on <camera-interface>; the count of mark files; whether the host'"'"'s neighbour table holds the camera'"'"'s hardware address at an address of the camera subnet (it prints "yes" or "no")'
    expected '1 address on the camera port, 0 mark files, "yes".'
    if [ "$HW_DRY" != 1 ] && [ -z "$HW_CAMERA_INTERFACE" ]; then hw_fail 2 'refused: --state needs --camera-interface. Nothing more was read.'; fi
    hw_addresses "$HW_CAMERA_INTERFACE"
    hw_marks
    hw_read_quiet 'neighbour table of the camera port' ip -4 neigh show dev "${HW_CAMERA_INTERFACE:-<camera-interface>}"
    if [ "$HW_DRY" = 1 ]; then
      hw_line '   would-compare: the one line of --hw-address-file with the lladdr column; prints yes or no, never the address'
    elif [ -z "$HW_HWADDR_FILE" ]; then
      HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
      # shellcheck disable=SC2016
      hw_reduce '{ for (k = 1; k < NF; k++) if ($k == "lladdr") c++ } END { print c + 0 }'
      obs 'neighbour entries with a hardware address on the camera port' "$HW_RED"
      hw_line '   NOT HANDED OVER: --hw-address-file was not given; "yes or no" for the camera'"'"'s own hardware address is missing'
    else
      HW_READ_COUNT=$((HW_READ_COUNT + 1))
      # shellcheck disable=SC2016
      wanted=$(awk 'NR == 1 { v = tolower($1); gsub(/-/, ":", v); print v }' "$HW_HWADDR_FILE")
      # shellcheck disable=SC2016
      hw_reduce '{ for (k = 1; k < NF; k++) if ($k == "lladdr" && tolower($(k + 1)) == w && w != "") hit = 1 } END { print hit ? "yes" : "no" }' -v w="$wanted"
      obs 'the neighbour table holds the camera'"'"'s hardware address on the camera port' "$HW_RED"
    fi
    ;;
  audit)
    step '9A/H-14.5' SCRIPT 'the count of entries CAMERA_NETWORK_SET since step .1; the count-only scan over the Core'"'"'s log, the error log and the audit details since step .1'
    expected '1 entry CAMERA_NETWORK_SET for the change (the number of entries per action is the one the closing report states; it is not 0); count-only scan: 0.'
    if hw_log_needed --audit-file "$HW_AUDIT"; then
      hw_count 'audit list' "${HW_AUDIT:-<audit>}" CAMERA_NETWORK_SET
    fi
    hw_secret_scan 'the Core log, the error log and the audit details since step .1' "$HW_CORE_LOG" "$HW_ERROR_LOG" "$HW_AUDIT"
    ;;
esac
note 'what to record (part 6): seconds to "found"; whether the camera restarted; the counts of criterion 2 to 5; the model name. Not: the old or the new address, the hardware address, the account name.'
hw_done
