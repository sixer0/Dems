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
HW_SUMMARY='the outcome line of the connection test; the audit entries of the test, the adoption and the assignment; the count-only scan (step .6)'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'Per camera, all of: 1. outcome "reachable" inside 15,000 ms; 2. profiles listed: at least 1 per video source of the camera, largest picture first; 3. the codec listed equals the codec the camera'"'"'s main stream is set to; 4. a profile adopted and assigned to its slot: 1 of 1; 5. occurrences of a credential form in any log: 0; 6. the stream-address query (C24): "located with a query", "no query on this camera", or "refused STREAM_LOCATOR_FORM"; the first two meet the criterion; 7. on a host with two networks (step .7, the USER'"'"'s reading): packets to the camera'"'"'s address on the office interface: 0 during the test and 0 during the watch; connections to the camera with another local address than the camera port'"'"'s: 0.'
step '9A/H-10.6' SCRIPT 'what the product states about a test: of the log line CAPTURE_CONNECTION_TESTED the members outcome, authenticated, testReason and judgedStreams; the count of the audit entries CAPTURE_CONNECTION_TESTED, CAPTURE_CANDIDATE_ADOPTED, CAPTURE_CREDENTIAL_SET and CAPTURE_CONFIG_CHANGED. The duration, the profile codes with codec and picture size and the three token facts are readings of USER and TECH. The count-only scan over the Core'"'"'s log and error log since step .2. It prints no token, no address and no account name.'
expected 'at least 1 profile; for a real camera the token usually has a character outside the code form ("yes"), and the profile was assigned all the same. Count-only scan: 0.'
if [ "$HW_DRY" != 1 ] && [ -z "$HW_CAMERA" ]; then hw_fail 2 'refused: --camera CAM-A (the housing label) is needed. Nothing more was read.'; fi
note "camera label: ${HW_CAMERA:-<label>}. The USER hands over the Core log of THIS camera's connect flow only (journalctl --since the click of step .2)."
if hw_log_needed --core-log "$HW_CORE_LOG"; then
  # NAMES (wave 12, row C1; each checked against the product source on 2026-10-14): the Core's one
  # log line of a test is CAPTURE_CONNECTION_TESTED with outcome, authenticated, sourceClass,
  # guardTripped, testReason, judgedStreams (modules/capture-discovery/connect/service.ts). Removed,
  # the product never emitted them: the code CAMERA_CONNECTION_TESTED, the fields reason, durationMs
  # and profiles, the line CAMERA_PROFILE_LISTED with its token members, and the code
  # CAMERA_CREDENTIAL_REFUSED. No log line states a duration, a profile or a fact about a token.
  hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_CONNECTION_TESTED outcome authenticated testReason judgedStreams guardTripped
  hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" REACHABLE AUTHENTICATION_FAILED WRONG_PROFILE NOT_H264 UNREACHABLE
  hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" STREAM_LOCATOR_FORM SCHEME_NOT_ALLOWED CAMERA_UNREACHABLE
  confirm 'that a test of a real camera writes the line CAPTURE_CONNECTION_TESTED (seen on doubles only). The duration is the difference of the two clock readings of steps .3 and .4, by USER; the profile codes, codecs and picture sizes are read from the screen by TECH; the three token facts are NOT available from a script, and no script may print a token to obtain them. A camera refused by the size of an ONVIF answer: which outcome word and which line it shows is not known (decision C100)'
fi
if hw_log_needed --audit-file "$HW_AUDIT"; then
  hw_count 'audit list' "${HW_AUDIT:-<audit>}" CAPTURE_CONNECTION_TESTED CAPTURE_CANDIDATE_ADOPTED CAPTURE_CREDENTIAL_SET CAPTURE_CONFIG_CHANGED
fi
hw_secret_scan 'the Core log and the error log since step .2' "$HW_CORE_LOG" "$HW_ERROR_LOG"
note 'what to record (part 6): label, model; milliseconds; number of video sources and profiles; codec set against codec listed; the profile code assigned; the three token facts; the query outcome; scan count. Not: token, stream address, account name, password.'
hw_done
