#!/bin/bash
# Hardware acceptance, check 9A/H-19 (chapter 3): S4, the long session, with a clap at its start
# and its end.
#   --before --data-dir D                                                            step .1
#   --session S4 --worker-log FILE [--core-log FILE] --data-dir D [--sudo-reads FILE]   step .6
# The two claps of step .5 are read with collect-h18.sh --session S4.
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h19.sh
HW_CHECK='9A/H-19'
HW_CHAPTER=3
HW_MODES='before session'
HW_SESSION_MODES='session'
HW_ACCEPTS='data-dir worker-log core-log sudo-reads'
HW_SUMMARY='free space and clock state before S4; length, faults, re-timed packets and free space after it'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'The magnitude of the drift is at most B-2 for both cameras: 2 of 2. S4 sealed and verified: 1 of 1. Camera and microphone faults during S4: the count is recorded; a fault that ends a track fails the check.'
free_space() {
  hw_read_quiet 'free space of the evidence disk' df -B1 --output=avail,size "${HW_DATA_DIR:-<data-dir>}"
  # shellcheck disable=SC2016
  hw_reduce 'NR == 2 { printf "%d bytes free of %d (%.1f GiB free)\n", $1, $2, $1 / 1073741824 }'
  obs 'evidence disk' "${HW_RED:-not readable by this account: the USER reads it with sudo df}"
}
case "$HW_MODE" in
  before)
    step '9A/H-19.1' SCRIPT 'free space of the evidence disk; timedatectl show -p NTPSynchronized --value'
    expected 'the free space is recorded; the clock is synchronised (the product does not stop a session when the disk fills: B-6).'
    if [ "$HW_DRY" != 1 ] && [ -z "$HW_DATA_DIR" ]; then hw_fail 2 'refused: --before needs --data-dir. Nothing more was read.'; fi
    free_space
    hw_read 'clock synchronised' timedatectl show -p NTPSynchronized --value
    ;;
  session)
    step '9A/H-19.6' SCRIPT 'the session'"'"'s length; faults by code and count; the notices; per camera the count of re-timed packets; the size of the package; free space after; the state and the failed verification items'
    expected 'The session records for B-3 minutes without a fault, seals and verifies. Two drift values of small magnitude.'
    user_step 'OPER reads in the web console and notes: the state (sealed), the failed verification items (0) and the notices of S4'
    if hw_log_needed --worker-log "$HW_WORKER_LOG"; then
      if [ "$HW_DRY" = 1 ]; then
        hw_line '   would-read: of the worker log, the time from "session_starting" to "worker_stopping", in seconds'
      else
        HW_READ_COUNT=$((HW_READ_COUNT + 1))
        # shellcheck disable=SC2016
        awk "$HW_AWK_JSON"'
          holds($0, "session_starting") { start = jget($0, "ts_us") + 0 }
          holds($0, "worker_stopping") { stop = jget($0, "ts_us") + 0 }
          END { if (start > 0 && stop > start) printf "length of the session by the worker: %d s (%.1f minutes)\n", int((stop - start) / 1000000), (stop - start) / 60000000; else print "length of the session by the worker: not determined" }' "$HW_WORKER_LOG" | while IFS= read -r line; do hw_line "      worker  | $line"; done
      fi
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" camera_summary cam video_packets fragments retimed dropped_no_pts bytes
      # NAMES (wave 12, row C1; checked against apps/capture-worker/src/audio.c and the Core's
      # capture/index.ts on 2026-10-14): MIC_NOT_DELIVERING was removed, the worker never emitted it
      # (its words are MIC_SILENT, MIC_DISCONNECTED, MIC_RATE_AT_LIMIT); the Core's fault line has no
      # deviceId (sessionId and reason are read); CAPTURE_WORKER_DOWN is counted because a worker
      # restart inside a session leaves a gap in the audio.
      hw_count 'worker log' "${HW_WORKER_LOG:-<worker-log>}" INGEST_ENDED MIC_SILENT MIC_DISCONNECTED MIC_RATE_AT_LIMIT
    fi
    if [ -n "$HW_CORE_LOG" ] || [ "$HW_DRY" = 1 ]; then
      hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_FAULT sessionId reason
      hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_FAULT EVIDENCE_VOLUME_SYNC_NOT_FULL STREAM_PROFILE_DIFFERS CAPTURE_CAMERA_CLOCK_OFFSET CAPTURE_WORKER_DOWN
    fi
    if [ -n "$HW_DATA_DIR" ] || [ "$HW_DRY" = 1 ]; then free_space; fi
    user_step 'sudo du -sb <data-dir>/media/sessions/<the folder of S4>     (the size of the package: one number into the file for --sudo-reads)'
    hw_handed 'the size of the package' "$HW_SUDO_READS" 'pass the file with --sudo-reads'
    ;;
esac
note 'what to record (part 6): B-2, B-3; four offsets and two drift values in milliseconds; length; faults; re-timed packets; sizes and free space; state; failed items.'
hw_done
