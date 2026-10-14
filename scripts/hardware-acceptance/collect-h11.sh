#!/bin/bash
# Hardware acceptance, check 9A/H-11 (chapter 3): S3, a camera's cable unplugged during a
# recording, then restored.
#   --session S3 --core-log FILE --worker-log FILE [--audit-file FILE]
#                [--camera CAM-A --track FILE --ffmpeg-prefix P]                    step .5
# --track: the unplugged camera's track of S3 in a file this account can read; its packet times
# are read and it is DECODED INTO NOTHING.
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h11.sh
HW_CHECK='9A/H-11'
HW_CHAPTER=3
HW_MODES='session'
HW_SESSION_MODES='session'
HW_ACCEPTS='core-log worker-log audit-file camera track ffmpeg-prefix'
HW_SUMMARY='faults raised and cleared, connection attempts, the gap in the track, decode errors, reveals'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'For the unplugged camera: fault raised 1, cleared 1; files of the track 1; gaps 1; decode errors 0. For the other camera: faults 0, gaps 0. S3 sealed and verified: 1 of 1. The gap in milliseconds and the outage are recorded.'
step '9A/H-11.5' SCRIPT 'for CAM-A: the count of loss faults raised and cleared, with their instants; the instants of the relay'"'"'s connection attempts; the number of files of its track; the length of the gap in the track in milliseconds; decode error lines of a full decode; the count of credential reveals of the session. For CAM-B: faults (count) and gaps (count). The state and the failed verification items.'
expected 'for CAM-A: 1 fault raised, 1 cleared; attempts at the intervals of the relay'"'"'s rule; 1 file for the track with 1 gap whose length equals the outage within 5 s; decode error lines 0; reveals of the session: 2. For CAM-B: 0 faults, 0 gaps.'
user_step 'OPER reads in the web console and notes: the state (sealed) and the failed verification items (0)'
if hw_log_needed --core-log "$HW_CORE_LOG"; then
  # NAMES (wave 12, row C1; each checked against the product source on 2026-10-14): the Core's fault
  # line of the supervisor carries code, sessionId, correlationId and reason (capture/index.ts); a
  # fault that is over is the line CAPTURE_SUPERVISOR_FAULT_OVER. Removed, the product never emitted
  # them: CAPTURE_FAULT_CLEARED, RELAY_CONNECT_ATTEMPT, RELAY_GAVE_UP, and the fields time, deviceId
  # and state of the fault line. The relay states a loss and a re-open as the report lines
  # camera_lost and camera_reopened on its own output; the Core reads them and raises and clears the
  # camera's fault, and writes no log line of its own for an attempt.
  hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_FAULT sessionId reason
  hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_FAULT CAMERA_STREAM_ENDED CAMERA_UNREACHABLE CAPTURE_SUPERVISOR_FAULT_OVER CAPTURE_RELAY_REPORT_SUPERSEDED CAPTURE_WORKER_DOWN
  confirm 'where the camera'"'"'s fault raised and cleared, and the instants of the relay'"'"'s re-open tries, can be read on a host: the audit extract of the session is the first place; the Core log holds no line per try, so "attempts" is recorded as "not readable" unless the extract states them'
fi
if hw_log_needed --worker-log "$HW_WORKER_LOG"; then
  hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" ingest_connected ts_us port codec
  hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" camera_summary cam video_packets fragments retimed bytes
  hw_count 'worker log' "${HW_WORKER_LOG:-<worker-log>}" INGEST_ENDED CAMERA_STREAM_ENDED
fi
if [ -n "$HW_AUDIT" ] || [ "$HW_DRY" = 1 ]; then
  # The exact type: a substring search for CREDENTIAL_REVEAL would also count a failed reveal.
  hw_count 'audit list' "${HW_AUDIT:-<audit>}" CAPTURE_CREDENTIAL_REVEALED CAPTURE_FAULT
fi
if [ -n "$HW_TRACK" ] || [ "$HW_DRY" = 1 ]; then
  if [ "$HW_DRY" != 1 ] && [ -z "$HW_FFMPEG_PREFIX" ]; then hw_fail 2 'refused: --track needs --ffmpeg-prefix. Nothing more was read.'; fi
  hw_read_quiet "packet times of the video track${HW_CAMERA:+ of $HW_CAMERA}" "${HW_FFMPEG_PREFIX:-<ffmpeg-prefix>}/bin/ffprobe" -hide_banner -v error -select_streams v:0 -show_entries packet=pts_time -of csv=p=0 "${HW_TRACK:-<track>}"
  # shellcheck disable=SC2016
  hw_reduce '$1 ~ /^[0-9.]+$/ { t = $1 + 0; if (n > 0) { d = t - last; if (d > 1.0) gaps++; if (d > max) max = d } last = t; n++ } END { printf "%d packets; gaps longer than 1 s: %d; the longest distance between two packets: %d ms\n", n, gaps, int(max * 1000 + 0.5) }'
  obs 'the video track' "$HW_RED"
  hw_read_quiet 'a full decode into nothing' "${HW_FFMPEG_PREFIX:-<ffmpeg-prefix>}/bin/ffmpeg" -hide_banner -nostdin -v error -i "${HW_TRACK:-<track>}" -f null -
  # shellcheck disable=SC2016
  hw_reduce 'length($0) > 0 { c++ } END { print c + 0 }'
  obs 'error lines of the full decode' "$HW_RED"
else
  note 'no --track given: the gap in the track and the decode errors are not read in this collection (run again with --run and --track for each camera)'
fi
note 'what to record (part 6): B-4; "power cut with the link" yes or no; the three clock readings; the counts; the gap in milliseconds; the attempts'"'"' intervals.'
hw_done
