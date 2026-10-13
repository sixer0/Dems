#!/bin/bash
# Hardware acceptance, check 9A/H-17 (chapter 3): S1, one session from two cameras and two
# microphone inputs, recorded, sealed and verified.
#   --live --core-pid N [--service-user U] [--sudo-reads FILE]                                  step .5
#   --sealed S1 --core-log FILE --worker-log FILE [--error-log FILE] [--journal-file FILE]
#               [--audit-file FILE] [--sudo-reads FILE] --install-dir D                         step .10
# "Recorded, not sealed" is not a pass. "Sealed, not verified" is not a pass. The state of the
# session and the verification report are read by OPER in the web console; this collector adds
# what the logs hold.
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h17.sh
HW_CHECK='9A/H-17'
HW_CHAPTER=3
HW_MODES='live sealed'
HW_SESSION_MODES='sealed'
HW_ACCEPTS='core-pid service-user sudo-reads core-log worker-log error-log journal-file audit-file install-dir'
HW_SUMMARY='the processes and listeners of S1 while it records; after the seal: notices, sync level, tracks, reveals and the count-only scan'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'Sessions from 4 production sources recorded, sealed and verified: 1. In detail, all of: 1. the session reached the state sealed: 1 of 1; 2. the verification passed on every item: failed items 0; 3. sources of the session: 4, of the production kinds, none generated; 4. both camera tracks hold video for the session and the audio is audible; 5. occurrences of a credential form and of an ingest-secret form in every searched place: 0; 6. a commissioning action during the session refused: 1 of 1.'
case "$HW_MODE" in
  live)
    step '9A/H-17.5' SCRIPT 'while S1 records: the processes of the session (the worker, two relays, two microphone helpers) with owner; the listeners (all on 127.0.0.1); by USER with sudo, the modes of the run directory and of the microphone pipes (HOST-08) and the four capability lines of the Core (HOST-39)'
    expected 'five processes of <service-user>; no listener on another address than 127.0.0.1; run directory 0700, pipes 0600, at least 1 pipe; four capability lines ending in sixteen zeros.'
    if [ "$HW_DRY" != 1 ] && [ -z "$HW_CORE_PID" ]; then hw_fail 2 'refused: --live needs --core-pid. Nothing more was read.'; fi
    hw_read_quiet 'process table' ps -eo pid=,ppid=,user=,comm=
    if [ "$HW_DRY" = 1 ]; then
      hw_line '   would-list: every descendant of the Core: process id, short name, and the owner as "<service-user>" or "another account"'
    else
      # shellcheck disable=SC2016
      printf '%s\n' "$HW_TEXT" | awk -v core="$HW_CORE_PID" -v u="$HW_SERVICE_USER" '
        { pid[NR] = $1; parent[$1] = $2; owner[$1] = $3; name[$1] = $4 }
        END {
          want[core] = 1; changed = 1
          while (changed) { changed = 0; for (i = 1; i <= NR; i++) if (!(pid[i] in want) && (parent[pid[i]] in want)) { want[pid[i]] = 1; changed = 1 } }
          for (i = 1; i <= NR; i++) if ((pid[i] in want) && pid[i] != core) { c++; mine = (u == "") ? "owner not compared" : (owner[pid[i]] == u ? "<service-user>" : "another account"); if (mine == "another account") foreign++; print "process " pid[i] " " name[pid[i]] " owner: " mine }
          print "processes of the session: " c + 0 "; not owned by the service user: " foreign + 0
        }' | while IFS= read -r line; do hw_line "      session | $line"; done
    fi
    hw_read_quiet 'listening TCP sockets' ss -H -ltn
    # shellcheck disable=SC2016
    hw_reduce '{ c++; if ($4 !~ /^127\./ && $4 !~ /^\[::1\]/) other++; n = split($4, part, ":"); p = part[n] + 0; if (p >= 8554 && p <= 8564) cam++ } END { print (c + 0) "; on ports 8554 to 8564: " (cam + 0) "; with a local address that is not a loopback address (any account): " (other + 0) }'
    obs 'listeners' "$HW_RED"
    hw_proc_lines 'the four capability lines of the Core (HOST-39)' "${HW_CORE_PID:-<core-pid>}" status '^Cap(Prm|Eff|Bnd|Amb):'
    user_step 'sudo find <data-dir>/run -type d ! -perm 700 | wc -l ; sudo find <data-dir>/run -type p ! -perm 600 | wc -l ; sudo find <data-dir>/run -type p | wc -l     (HOST-08: 0, 0, at least 1; three numbers into the file for --sudo-reads)'
    user_step "sudo ss -H -ltnp | grep -c 'pid=' ; and the local addresses of the Core's own listeners     (all 127.0.0.1)"
    hw_handed 'the administrator readings of step .5' "$HW_SUDO_READS" 'pass the file with --sudo-reads'
    ;;
  sealed)
    step '9A/H-17.10' SCRIPT 'the session'"'"'s state; the capture operation the session states; its sources; the tracks of the package with their sizes; every notice of the session by its code, with "critical" yes or no; the sync level per camera file; the verification result per item; the count of credential reveals the audit list holds for this session; the count-only scan over the Core'"'"'s log, the error log, the worker'"'"'s log, the session tables and the journal, for both forms'
    expected 'state sealed; operation REAL_PRODUCTION; 4 sources, 2 cameras and 2 microphone inputs, each declared a production device; 2 camera tracks with video and the audio of the primary microphone; notices as they are; reveals: 2, one per camera; both scans: 0.'
    user_step 'OPER reads in the web console and notes: the state (sealed); the sources (count, kind, how each is declared); the verification report per item (failed items: 0). No script signs in to the Core.'
    if hw_log_needed --core-log "$HW_CORE_LOG"; then
      hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_FENCE_PASSED operation
      hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_SYNC_LEVEL deviceId syncLevel
      hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_SYNC_LEVEL_NOT_FULL deviceId syncLevel
      hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" EVIDENCE_VOLUME_SYNC_NOT_FULL syncLevel critical
      hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" STREAM_PROFILE_DIFFERS EVIDENCE_VOLUME_SYNC_NOT_FULL CAPTURE_FAULT CAMERA_CLOCK_OFFSET SESSION_SEALED UNSEALABLE
      confirm 'the codes by which the Core logs the seal of a session and its notices; the list of notices with "critical" is read by OPER from the verification report where the log does not hold it'
    fi
    if hw_log_needed --worker-log "$HW_WORKER_LOG"; then
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" camera_summary cam video_packets audio_packets fragments durable_fragments bytes sync
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" worker_exit rc
    fi
    if [ -n "$HW_AUDIT" ] || [ "$HW_DRY" = 1 ]; then
      hw_count_part 'audit list' "${HW_AUDIT:-<audit>}" CREDENTIAL_REVEAL
    fi
    user_step 'sudo ls -l <data-dir>/media/sessions/<the folder of S1>     (the tracks of the package with their sizes; names and sizes only, into the file for --sudo-reads)'
    hw_handed 'the tracks of the package with their sizes' "$HW_SUDO_READS" 'pass the file with --sudo-reads'
    hw_secret_scan 'the Core log, the error log, the worker log, the journal and the audit list (both forms)' "$HW_CORE_LOG" "$HW_ERROR_LOG" "$HW_WORKER_LOG" "$HW_JOURNAL" "$HW_AUDIT"
    ;;
esac
note 'what to record (part 6): the clock at start, at both claps and at the end; the state; failed verification items (count); sources (count and kinds); notices by code with "critical"; reveals; the two scan counts; the session'"'"'s identifier in the product. Not: a frame, a sound, a word spoken, the content of the room.'
hw_done
