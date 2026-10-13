#!/bin/bash
# Hardware acceptance, check 9A/H-22 (chapter 3): S2, a camera absent at the start.
#   --session S2 --worker-log FILE [--core-log FILE] [--audit-file FILE] [--sudo-reads FILE]     step .5
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h22.sh
HW_CHECK='9A/H-22'
HW_CHAPTER=3
HW_MODES='session'
HW_SESSION_MODES='session'
HW_ACCEPTS='worker-log core-log audit-file sudo-reads'
HW_SUMMARY='time to the first connect, warnings and audit entries for the absent camera, the tracks of the package'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'The session started with one camera: 1 of 1. Warnings for the absent camera: 1. Audit entries for it: 1. Material of the absent camera in the package: 0. S2 sealed and verified: 1 of 1. The time to recording is recorded.'
step '9A/H-22.5' SCRIPT 'the time from the start request to the state recording, in milliseconds; warnings and audit entries that name the absent camera (counts, codes); the tracks of the package with their sizes; the state; failed verification items'
expected '1 warning and 1 audit entry for the absent camera; the package holds the track of CAM-A and nothing of CAM-B: 0 fragments, no entry for its file.'
user_step 'OPER reads in the web console and notes: the state (sealed) and the failed verification items (0)'
if hw_log_needed --worker-log "$HW_WORKER_LOG"; then
  if [ "$HW_DRY" = 1 ]; then
    hw_line '   would-read: of the worker log, the time from "session_starting" to the first "ingest_connected" and to each open that failed, in milliseconds'
  else
    HW_READ_COUNT=$((HW_READ_COUNT + 1))
    # shellcheck disable=SC2016
    awk "$HW_AWK_JSON"'
      holds($0, "session_starting") { start = jget($0, "ts_us") + 0 }
      start > 0 && holds($0, "ingest_connected") { print "connect report, port " safe(jget($0, "port")) ": " int((jget($0, "ts_us") - start) / 1000) " ms after the worker started the session" }
      start > 0 && (holds($0, "INGEST_OPEN_FAILED") || holds($0, "CAMERA_NOT_CONNECTED")) { print "open given up, port " safe(jget($0, "port")) ": " int((jget($0, "ts_us") - start) / 1000) " ms after the worker started the session; reason " safe(jget($0, "reason")) }' "$HW_WORKER_LOG" | while IFS= read -r line; do hw_line "      worker  | $line"; done
  fi
  hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" camera_summary cam video_packets fragments bytes
fi
if [ -n "$HW_CORE_LOG" ] || [ "$HW_DRY" = 1 ]; then
  hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" CAMERA_NOT_CONNECTED CAPTURE_FAULT
  confirm 'the code of the one warning that names the absent camera, and the instant of the state "recording" in the Core log'
fi
if [ -n "$HW_AUDIT" ] || [ "$HW_DRY" = 1 ]; then
  hw_count 'audit list' "${HW_AUDIT:-<audit>}" CAMERA_NOT_CONNECTED CAPTURE_FAULT
fi
user_step 'sudo ls -l <data-dir>/media/sessions/<the folder of S2>     (names and sizes only; into the file for --sudo-reads)'
hw_handed 'the tracks of the package with their sizes' "$HW_SUDO_READS" 'pass the file with --sudo-reads'
note 'what to record (part 6): milliseconds to recording; the three counts; "joined after return: no"; state; failed items.'
hw_done
