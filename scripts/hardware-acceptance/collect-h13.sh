#!/bin/bash
# Hardware acceptance, check 9A/H-13 (chapter 3): the factory-address scan finds a factory-new
# camera plugged in alone.
#   --state --camera-interface IF                                   step .4
#   --audit --audit-file FILE --core-log FILE --install-dir D       step .6
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h13.sh
HW_CHECK='9A/H-13'
HW_CHAPTER=3
HW_MODES='state audit'
HW_SESSION_MODES=''
HW_ACCEPTS='camera-interface audit-file core-log install-dir'
HW_SUMMARY='addresses and marks after the scan; the audit entries of the scan; the count-only scan of the Core log'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'CAM-N found: 1 of 1, and by which way is recorded ("stored list" or "typed address"). Scan entries: 1 per scan. Temporary addresses left after the scan: 0. The role without the permission reaches the function: 0 of 1. Rows stored for the camera that is not adopted: 0.'
case "$HW_MODE" in
  state)
    step '9A/H-13.4' SCRIPT 'after the scan has ended: the count of addresses on <camera-interface>; the count of mark files of the helper'
    expected '1 address on the camera port and 0 mark files: the scan removed what it added.'
    if [ "$HW_DRY" != 1 ] && [ -z "$HW_CAMERA_INTERFACE" ]; then hw_fail 2 'refused: --state needs --camera-interface. Nothing more was read.'; fi
    hw_addresses "$HW_CAMERA_INTERFACE"
    hw_marks
    ;;
  audit)
    step '9A/H-13.6' SCRIPT 'the count of entries CAMERA_FACTORY_SCANNED, HOST_ALIAS_ADDED and HOST_ALIAS_REMOVED since step .2; the count-only scan over the Core'"'"'s log since step .2'
    expected '1 scan entry per scan run; added and removed entries in equal number; count-only scan: 0.'
    if hw_log_needed --audit-file "$HW_AUDIT"; then
      hw_count 'audit list' "${HW_AUDIT:-<audit>}" CAMERA_FACTORY_SCANNED HOST_ALIAS_ADDED HOST_ALIAS_REMOVED HOST_ALIAS_REMOVE_FAILED
    fi
    hw_secret_scan 'the Core log since step .2' "$HW_CORE_LOG"
    ;;
esac
note 'what to record (part 6): the way it was found; the model name of CAM-N (the per-camera sheet); the counts of criterion 2 to 5. Not: the factory address, the hardware address.'
hw_done
