#!/bin/bash
# Hardware acceptance, check 9A/H-10 (chapter 3): the connect flow with real profile tokens; a
# profile assigned to a slot. Once per camera.
#   --camera CAM-A --core-log FILE [--error-log FILE] [--audit-file FILE] --install-dir D     step .6
# The account and the password are typed by USER or TECH into the web console only.
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h10.sh
HW_CHECK='9A/H-10'
HW_CHAPTER=3
HW_MODES=''
HW_SESSION_MODES=''
HW_ACCEPTS='camera core-log error-log audit-file install-dir'
HW_SUMMARY='per listed profile its code, codec, picture size and three yes-or-no facts about its token; the test duration; the count-only scan (step .6)'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'Per camera, all of: 1. outcome "reachable" inside 15,000 ms; 2. profiles listed: at least 1 per video source of the camera, largest picture first; 3. the codec listed equals the codec the camera'"'"'s main stream is set to; 4. a profile adopted and assigned to its slot: 1 of 1; 5. occurrences of a credential form in any log: 0; 6. the stream-address query (C24): "located with a query", "no query on this camera", or "refused STREAM_LOCATOR_FORM"; the first two meet the criterion.'
step '9A/H-10.6' SCRIPT 'for each listed profile: its code; the codec and picture size; three yes-or-no facts about its camera-side token (has a character outside the code form, is digits only, is listed). The duration of the test in milliseconds. The count of audit entries of the adoption and of CAPTURE_CONFIG_CHANGED. The count-only scan over the Core'"'"'s log and error log since step .2. It prints no token, no address and no account name.'
expected 'at least 1 profile; for a real camera the token usually has a character outside the code form ("yes"), and the profile was assigned all the same. Count-only scan: 0.'
if [ "$HW_DRY" != 1 ] && [ -z "$HW_CAMERA" ]; then hw_fail 2 'refused: --camera CAM-A (the housing label) is needed. Nothing more was read.'; fi
note "camera label: ${HW_CAMERA:-<label>}. The USER hands over the Core log of THIS camera's connect flow only (journalctl --since the click of step .2)."
if hw_log_needed --core-log "$HW_CORE_LOG"; then
  hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAMERA_CONNECTION_TESTED outcome reason durationMs profiles
  hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAMERA_PROFILE_LISTED profileCode codec width height tokenOutsideCodeForm tokenDigitsOnly listed
  hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" STREAM_LOCATOR_FORM CAMERA_CREDENTIAL_REFUSED CAMERA_UNREACHABLE WRONG_PROFILE
  confirm 'the codes and fields by which the Core logs the outcome of a connection test and each listed profile (rows 26, 50, 51 had no log contract for this when the collector was written). A field printed "(absent)" is read from the screen by TECH; the three token facts are then NOT available from a script, and no script may print a token to obtain them'
fi
if hw_log_needed --audit-file "$HW_AUDIT"; then
  hw_count 'audit list' "${HW_AUDIT:-<audit>}" CAPTURE_CONFIG_CHANGED
  hw_count_part 'audit list' "${HW_AUDIT:-<audit>}" ADOPTED
fi
hw_secret_scan 'the Core log and the error log since step .2' "$HW_CORE_LOG" "$HW_ERROR_LOG"
note 'what to record (part 6): label, model; milliseconds; number of video sources and profiles; codec set against codec listed; the profile code assigned; the three token facts; the query outcome; scan count. Not: token, stream address, account name, password.'
hw_done
