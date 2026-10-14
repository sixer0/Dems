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
criterion 'The scan row does not state ONE while two cameras answer on the address: 1 of 1 (the word seen, NOT_KNOWN or MORE_THAN_ONE, is recorded). No set-address job started: 0 jobs, 0 entries CAMERA_NETWORK_SET. Cameras changed: 0 of 2. "Conflict reported" is recorded as yes or no; "no" with NOT_KNOWN is the stated limit and does not fail the check.'
note 'the scan'"'"'s word for the number of devices at an address (deviceCount: ONE, MORE_THAN_ONE or NOT_KNOWN; as built always NOT_KNOWN) is on the screen of the scan; TECH reads it there. The audit entry of a scan, CAMERA_FACTORY_SCANNED, holds counts only; the word is a member of the entry CAMERA_NETWORK_SET of a job, and no job is started in this check. This collector counts entries.'
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
