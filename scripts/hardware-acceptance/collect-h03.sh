#!/bin/bash
# Hardware acceptance, check 9A/H-03 (chapter 2): the durability level the evidence disk gives.
# An OBSERVATION, not a verdict (chapter 2, part 5 of the check).
#   --disk  --media-dir <throw-away media store> --data-dir <data-dir>     step .1
#   --level --core-log FILE [--worker-log FILE]                             step .3
# The log files are handed over by the USER (the Core of this check runs in a terminal: its
# output saved to a file; the worker's log is capture-worker.jsonl of the data directory).
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h03.sh
HW_CHECK='9A/H-03'
HW_CHAPTER=2
HW_MODES='disk level'
HW_ACCEPTS='media-dir data-dir core-log worker-log'
HW_SUMMARY='the file system under both media stores; the sync level per camera file and its notice'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"

criterion 'This check is an observation, not a verdict. It is PASS when one of the three outcomes is recorded with the file system type and the level; it is FAIL only when no level line exists for a recorded camera file.'
case "$HW_MODE" in
  disk)
    step '9A/H-03.1' SCRIPT 'findmnt -no FSTYPE,SOURCE,OPTIONS --target for the throw-away media store and for <data-dir>/media/sessions'
    expected 'the same source for both folders; a local Linux file system.'
    if [ "$HW_DRY" != 1 ]; then
      [ -n "$HW_MEDIA_DIR" ] && [ -n "$HW_DATA_DIR" ] || hw_fail 2 'refused: --disk needs --media-dir and --data-dir. Nothing more was read.'
    fi
    hw_read 'throw-away media store' findmnt -no FSTYPE,SOURCE,OPTIONS --target "${HW_MEDIA_DIR:-<throw-away-media>}"
    first=$HW_TEXT
    hw_read 'acceptance media store' findmnt -no FSTYPE,SOURCE,OPTIONS --target "${HW_DATA_DIR:-<data-dir>}/media/sessions"
    if [ "$HW_DRY" = 1 ]; then
      obs 'both folders on the same source' ''
    elif [ -z "$first" ] || [ -z "$HW_TEXT" ]; then
      obs 'both folders on the same source' 'not readable by this account (the folders are owner-only): the USER reads both with sudo findmnt and notes them'
    else
      a=${first#* }
      b=${HW_TEXT#* }
      if [ "${a%% *}" = "${b%% *}" ]; then obs 'both folders on the same source' yes; else obs 'both folders on the same source' no; fi
      obs 'file system type of the acceptance media store' "${HW_TEXT%% *}"
    fi
    ;;
  level)
    step '9A/H-03.3' SCRIPT 'per camera file, the line with code CAPTURE_SYNC_LEVEL or CAPTURE_SYNC_LEVEL_NOT_FULL and its stated level; any notice EVIDENCE_VOLUME_SYNC_NOT_FULL with its level and whether it is marked critical'
    expected 'one level line per camera file, 2 lines. Either both state the full level and no notice exists, or both state a weaker level (FSYNC, or NOT_STATED) and the notice exists once per camera file.'
    if hw_log_needed --core-log "$HW_CORE_LOG"; then
      hw_fields 'Core log' "$HW_CORE_LOG" CAPTURE_SYNC_LEVEL deviceId syncLevel
      hw_fields 'Core log' "$HW_CORE_LOG" CAPTURE_SYNC_LEVEL_NOT_FULL deviceId syncLevel
      hw_fields 'Core log' "$HW_CORE_LOG" EVIDENCE_VOLUME_SYNC_NOT_FULL syncLevel critical
      hw_count 'Core log' "$HW_CORE_LOG" CAPTURE_SYNC_LEVEL CAPTURE_SYNC_LEVEL_NOT_FULL EVIDENCE_VOLUME_SYNC_NOT_FULL
      confirm 'whether the notice of a session is written to the Core log with the fields syncLevel and critical; if not, the OPER reads the notices of the session in the web console and notes count and "critical"'
    fi
    if [ -n "$HW_WORKER_LOG" ] || [ "$HW_DRY" = 1 ]; then
      note 'the worker states the level it achieved with the first durable fragment of each camera file'
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" first_durable_fragment cam sync sync_wanted
    fi
    note 'outcomes: 1 = full level, no notice; 2 = level FSYNC (hypothesis H-K holds; THE USER MUST DECIDE before the ruling); 3 = NOT_STATED (as 2, and a product finding)'
    ;;
esac
note 'what to record (part 6): file system type; the level per camera file; notices: count, and "critical" yes or no; the outcome number.'
hw_done
