#!/bin/bash
# Hardware acceptance, check 9A/H-15 (chapter 3): two cameras on one factory address: reported,
# set-address refused, neither changed.
#   --audit-file FILE --camera-interface IF        step .4
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h15.sh
HW_CHECK='9A/H-15'
HW_CHAPTER=3
HW_MODES=''
HW_SESSION_MODES=''
HW_ACCEPTS='audit-file camera-interface'
HW_SUMMARY='the count of set-address entries and of addresses on the camera port (step .4)'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'Conflict reported: 1 of 1. Set-address refused: 1 of 1. Cameras changed: 0 of 2.'
step '9A/H-15.4' SCRIPT 'the count of entries CAMERA_NETWORK_SET since step .1; the count of addresses on <camera-interface> after the last scan'
expected 'entries CAMERA_NETWORK_SET: 0; 1 address on the camera port.'
if hw_log_needed --audit-file "$HW_AUDIT"; then
  hw_count 'audit list' "${HW_AUDIT:-<audit>}" CAMERA_NETWORK_SET CAMERA_FACTORY_SCANNED
fi
if [ "$HW_DRY" != 1 ] && [ -z "$HW_CAMERA_INTERFACE" ]; then
  HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
  hw_line '   NOT COLLECTED: --camera-interface was not given; the address count is missing'
else
  hw_addresses "$HW_CAMERA_INTERFACE"
fi
note 'what to record (part 6): the three counts; whether a password field was offered at step .2. Not: any address. No password is typed in this check, whatever the screen offers.'
hw_done
