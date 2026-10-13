#!/bin/bash
# Hardware acceptance, check 9A/H-21 (chapter 3): time from the start of S1 to both camera ingests
# connected.
#   --session S1 --worker-log FILE [--core-log FILE]         step .1
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h21.sh
HW_CHECK='9A/H-21'
HW_CHAPTER=3
HW_MODES='session'
HW_SESSION_MODES='session'
HW_ACCEPTS='worker-log core-log'
HW_SUMMARY='the instant of the session start and of each camera connect, and their differences in milliseconds'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'Both cameras connected inside 30,000 ms; the larger figure is the measured value.'
step '9A/H-21.1' SCRIPT 'the instant of the session'"'"'s start request and, per camera, the instant at which the camera counts as open (the relay'"'"'s report and the worker'"'"'s connect report for its port, both present); the two differences in milliseconds; the count of camera faults at the start'
expected 'Two figures, each below 30,000 ms; 0 camera faults at the start.'
if hw_log_needed --worker-log "$HW_WORKER_LOG"; then
  if [ "$HW_DRY" = 1 ]; then
    hw_line '   would-read: of the worker log, the time of "session_starting" and of every "ingest_connected" (its port and codec); the differences in milliseconds'
  else
    HW_READ_COUNT=$((HW_READ_COUNT + 1))
    # shellcheck disable=SC2016
    awk "$HW_AWK_JSON"'
      holds($0, "session_starting") { start = jget($0, "ts_us") + 0; starts++ }
      holds($0, "ingest_connected") && start > 0 { n++; ms = int((jget($0, "ts_us") - start) / 1000); if (ms > max) max = ms; print "camera on port " safe(jget($0, "port")) " (" safe(jget($0, "codec")) "): connect report " ms " ms after the worker started the session" }
      END { print "session starts in this log: " starts + 0 "; connect reports after the last start: " n + 0 "; the larger figure: " (n ? max " ms" : "none") }' "$HW_WORKER_LOG" | while IFS= read -r line; do hw_line "      worker  | $line"; done
    hw_count 'worker log' "$HW_WORKER_LOG" INGEST_OPEN_FAILED INGEST_ANNOUNCE_NOT_MATCHED INGEST_NO_EXTRADATA CAMERA_NOT_CONNECTED
  fi
  note 'the figure counts from the instant the WORKER started the session. The instant of the operator'"'"'s start request and the relay'"'"'s own report lie in the Core log; the USER adds the difference between the two instants if the Core log states them'
fi
if [ -n "$HW_CORE_LOG" ] || [ "$HW_DRY" = 1 ]; then
  hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_FAULT CAMERA_NOT_CONNECTED CAMERA_STREAM_ENDED
  confirm 'the codes of the session start request and of the relay'"'"'s report in the Core log (the camera path was not built when chapter 3 was written)'
fi
note 'what to record (part 6): the two figures in milliseconds; the keyframe interval each camera is set to.'
hw_done
