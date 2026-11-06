#!/bin/bash
# Hardware acceptance, check 9A/H-23 (chapter 3): a camera account whose password has special
# characters authenticates.
#   --after-test --core-log FILE [--error-log FILE] --install-dir D                                   step .3
#   --after-session S1 --worker-log FILE --core-log FILE [--error-log FILE] [--journal-file FILE]
#                      [--sudo-reads FILE] --install-dir D [--camera CAM-A]                           step .4
# --sudo-reads here: the session's persisted lines, if the USER saved them to a file.
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h23.sh
HW_CHECK='9A/H-23'
HW_CHAPTER=3
HW_MODES='after-test after-session'
HW_SESSION_MODES='after-session'
HW_ACCEPTS='core-log error-log worker-log journal-file sudo-reads install-dir camera'
HW_SUMMARY='the outcome of the connection test and the count-only scans after the test and after S1'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'Authenticated in the connection test: 1 of 1. Recorded in S1: 1 of 1. Occurrences of a credential form: 0 at both searches. Characters exercised: n of 5, recorded; with n = 0 the check is NOT RUN: the camera accepts none of the characters.'
case "$HW_MODE" in
  after-test)
    step '9A/H-23.3' SCRIPT 'the outcome code of the connection test for this camera, and whether its stream half authenticated; the count-only scan over the Core'"'"'s log and error log'
    expected '"reachable"; the stream half authenticated (the codec was read from the stream); scan: 0.'
    if hw_log_needed --core-log "$HW_CORE_LOG"; then
      # NAMES (wave 12, row C1; checked against modules/capture-discovery/connect/service.ts on
      # 2026-10-14): the line is CAPTURE_CONNECTION_TESTED with outcome, authenticated, testReason,
      # judgedStreams. Removed, the product never emitted them: CAMERA_CONNECTION_TESTED, the fields
      # reason, durationMs and codec, and the codes CAMERA_CREDENTIAL_REFUSED and
      # STREAM_AUTHENTICATION_FAILED (the outcome is AUTHENTICATION_FAILED; a camera that offers only
      # Basic authentication has the reason SCHEME_NOT_ALLOWED).
      hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_CONNECTION_TESTED outcome authenticated testReason judgedStreams
      hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" AUTHENTICATION_FAILED SCHEME_NOT_ALLOWED
      confirm 'that the stream half authenticated when the outcome is REACHABLE and judgedStreams is above 0 (the codec of a listed profile is read from the stream; seen on doubles only)'
    fi
    hw_secret_scan 'the Core log and the error log' "$HW_CORE_LOG" "$HW_ERROR_LOG"
    ;;
  after-session)
    step '9A/H-23.4' SCRIPT 'after S1 is sealed: whether this camera'"'"'s track of S1 holds video; the count-only scan over the Core'"'"'s log, the error log, the worker'"'"'s log of S1, the session'"'"'s persisted lines and the journal of the Core'"'"'s unit'
    expected 'the track holds video; scan: 0 in every place.'
    if hw_log_needed --worker-log "$HW_WORKER_LOG"; then
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" camera_summary cam video_packets fragments bytes
      note 'the camera of this check is the one TECH assigned to video slot 1 (cam 1) or 2 (cam 2); video_packets above 0 means its track holds video'
    fi
    hw_secret_scan 'the Core log, the error log, the worker log, the persisted lines and the journal' "$HW_CORE_LOG" "$HW_ERROR_LOG" "$HW_WORKER_LOG" "$HW_SUDO_READS" "$HW_JOURNAL"
    ;;
esac
note 'what to record (part 6): n of 5 and the refused characters; the outcome; "recorded in S1" yes or no; the two scan counts. Not: the password or any part of it beyond the list of characters.'
hw_done
