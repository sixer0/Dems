#!/bin/bash
# Hardware acceptance, check 9A/H-12 (chapter 3): camera search on the real network; a typed
# address yields a candidate.
#   --audit-file FILE --core-log FILE          step .5
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h12.sh
HW_CHECK='9A/H-12'
HW_CHAPTER=3
HW_MODES=''
HW_SESSION_MODES=''
HW_ACCEPTS='audit-file core-log'
HW_SUMMARY='the search entries of the audit list and the candidate counts of the Core log (step .5)'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'Candidates from the search without a typed address: at least 1. Candidate from the typed address: 1. The address outside the private ranges refused: 1 of 1. Whether the rule of HOST-23 alone sufficed is recorded as yes or no.'
step '9A/H-12.5' SCRIPT 'from the audit list, the count of entries CAPTURE_DISCOVERY_SEARCHED with the scope CAMERA_NETWORK since step .2; from the Core'"'"'s log, the count of candidates each search returned and any refusal code. No address is printed.'
expected '2 or 3 search entries (whether a refused address writes one is recorded as seen); candidate counts as read on the screen.'
user_step 'save the audit list since step .2 as a text file, one entry per line (--audit-file); save the journal of the Core since step .2 (journalctl -u dems-core.service --since <time> --no-pager -o cat > <file>; --core-log)'
if hw_log_needed --audit-file "$HW_AUDIT"; then
  hw_count 'audit list' "${HW_AUDIT:-<audit>}" CAPTURE_DISCOVERY_SEARCHED CAMERA_NETWORK
fi
if hw_log_needed --core-log "$HW_CORE_LOG"; then
  hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_DISCOVERY_SEARCHED scope candidates outcome reason
  hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" DISCOVERY_ADDRESS_NOT_PRIVATE ADDRESS_NOT_PRIVATE INVALID_INPUT
  confirm 'the fields in which a search states its scope and its candidate count, and the refusal code of an address outside the private ranges'
fi
note 'what to record (part 6): the three candidate counts; "rule alone sufficed: yes or no"; the refusal of .4; the entry count. Not: an address, a camera'"'"'s serial number.'
hw_done
