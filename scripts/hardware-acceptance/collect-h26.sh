#!/bin/bash
# Hardware acceptance, check 9A/H-26 (chapter 3): the notice STREAM_PROFILE_DIFFERS is not raised
# for the H.265 cameras.
#   --session S1 --core-log FILE [--worker-log FILE]        step .1
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h26.sh
HW_CHECK='9A/H-26'
HW_CHAPTER=3
HW_MODES='session'
HW_SESSION_MODES='session'
HW_ACCEPTS='core-log worker-log'
HW_SUMMARY='the profile code per camera, the stream statement of the seal, and the count of the notice'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'Notices STREAM_PROFILE_DIFFERS in S1 for H.265 cameras: 0, in the collector'"'"'s reading and in the report: 2 of 2 readings.'
step '9A/H-26.1' SCRIPT 'per camera of S1, the profile code in the selector at the start, the stream statement the seal wrote, and the count of notices STREAM_PROFILE_DIFFERS in the sealed session'
expected 'per H.265 camera the code begins HEVC_ and the seal'"'"'s statement equals it or is the code without its rate; notices of this type: 0.'
if hw_log_needed --core-log "$HW_CORE_LOG"; then
  hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" STREAM_PROFILE_DIFFERS
  hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" STREAM_PROFILE_DIFFERS deviceId configured recorded
  hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" SESSION_SOURCE_OPENED deviceId profileCode
  hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" SESSION_SEALED streamStatement
  confirm 'where the profile code of the selector and the seal'"'"'s stream statement are logged; if a field prints "(absent)", OPER reads both codes from the session'"'"'s facts and the verification report (they are codes, not secrets)'
fi
if [ -n "$HW_WORKER_LOG" ] || [ "$HW_DRY" = 1 ]; then
  hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" ingest_connected port codec width height
fi
note 'if both cameras ran on H.264 by the fallback, the check is NOT RUN: no H.265 camera in S1.'
note 'what to record (part 6): per camera the code and the seal'"'"'s statement; the notice count.'
hw_done
