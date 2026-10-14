#!/bin/bash
# Hardware acceptance, check 9A/H-09 (chapter 3): H.265 through the relay: codec as the stream's,
# counters, clock offset, decodable file. Read from S1; no recording of its own.
#   --live --worker-log FILE [--core-log FILE]                      step .1, during S1
#   --session S1 --worker-log FILE [--core-log FILE]                step .1, after S1
#   --file S1 --camera CAM-A --track FILE --ffmpeg-prefix P         step .2, after S1 is sealed
# --track: one camera file of S1 that this account can read (from an export of the session, or a
# copy the USER makes). It is probed and DECODED INTO NOTHING; no frame leaves the host.
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# NAMES (wave 12, row C1; each checked against the product source on 2026-10-14): the worker's lines
# are `video_anchored` (mode, shift_us) and `keyframe_interval_observed` (cam, observed_ms, bound_ms,
# intervals, complete, above_bound), apps/capture-worker/src/ingest.c; `camera_summary` carries five
# counters. The Core's measurement line is CAPTURE_CLOCK_OFFSET_MEASURED (deviceId, offsetMs,
# advisoryMs, above), capture-session/index.ts. Removed, the product never emitted them: the lines
# `anchored` and `keyframe_interval`, the fields offset_us, interval_ms, frames, clockOffsetMs.
# CAMERA_CLOCK_OFFSET is kept as a count only: it is the notice of a camera above the advisory, and
# CAPTURE_CAMERA_CLOCK_OFFSET is the code of the Core's persisted warning for the same case.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h09.sh
HW_CHECK='9A/H-09'
HW_CHAPTER=3
HW_MODES='live session file'
HW_SESSION_MODES='session file'
HW_ACCEPTS='worker-log core-log camera track ffmpeg-prefix'
HW_SUMMARY='per camera: connect line, counters and clock offset from the logs; codec, sample entry, frame count and decode errors of its file'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'Per camera, all of: the codec in the connect line equals the codec the camera is set to; INGEST_NO_EXTRADATA lines 0; decode errors 0; frames in the file equal the worker'"'"'s packet count; clock offset at most 2,000 ms (the figure is recorded; an advisory above 500 ms is recorded and is not a fail).'
case "$HW_MODE" in
  live | session)
    step '9A/H-09.1' SCRIPT 'per camera: from the worker'"'"'s log, the connect line (codec, picture size, parameter-set length), the count of lines INGEST_NO_EXTRADATA, the anchoring mode, the observed keyframe interval, and the line that sums the camera up (video packets, fragments, and its five counters); from the session, the clock offset of the camera in milliseconds and whether the advisory was raised'
    expected 'per camera: codec hevc for a camera set to H.265; INGEST_NO_EXTRADATA: 0 lines; one summing line with video packets above 0; a clock offset of at most 2,000 ms.'
    if hw_log_needed --worker-log "$HW_WORKER_LOG"; then
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" ingest_connected port codec width height extradata
      hw_count 'worker log' "${HW_WORKER_LOG:-<worker-log>}" INGEST_NO_EXTRADATA
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" video_anchored mode shift_us
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" keyframe_interval_observed cam observed_ms bound_ms intervals above_bound
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" camera_summary cam video_packets fragments dropped_no_pts dropped_prestart retimed dropped_prearm dropped_unanchored
      note 'the worker'"'"'s summing line carries five counters. The first three read here are "the three" of the plan: dropped_no_pts, dropped_prestart, retimed; dropped_prearm and dropped_unanchored are recorded beside them (open point B of chapter 3). In --live the summing line does not exist yet. The line video_anchored names its camera by the source of the line, not by a member.'
      confirm 'that a real camera'"'"'s stream produces the lines video_anchored and keyframe_interval_observed (seen on generated streams only)'
    fi
    if [ -n "$HW_CORE_LOG" ] || [ "$HW_DRY" = 1 ]; then
      hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_CLOCK_OFFSET_MEASURED deviceId offsetMs advisoryMs above
      hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_CLOCK_OFFSET_MEASURED CAPTURE_CAMERA_CLOCK_OFFSET CAMERA_CLOCK_OFFSET
      confirm 'that a real camera'"'"'s clock read produces the line CAPTURE_CLOCK_OFFSET_MEASURED; the advisory itself is read by OPER on the monitor (step .3)'
    fi
    ;;
  file)
    step '9A/H-09.2' SCRIPT 'after S1 is sealed, per camera file, read-only with the pinned tools: the codec and sample entry of the video track; the frame count; the number of error lines of a full decode into nothing'
    expected 'codec hevc, sample entry hev1; the frame count equals the worker'"'"'s count of video packets; decode error lines: 0.'
    if [ "$HW_DRY" != 1 ]; then
      [ -n "$HW_TRACK" ] && [ -n "$HW_FFMPEG_PREFIX" ] && [ -n "$HW_CAMERA" ] || hw_fail 2 'refused: --file needs --camera, --track and --ffmpeg-prefix. Nothing more was read.'
    fi
    hw_read 'codec, sample entry and counted frames of the video track' "${HW_FFMPEG_PREFIX:-<ffmpeg-prefix>}/bin/ffprobe" -hide_banner -v error -select_streams v:0 -count_frames -show_entries stream=codec_name,codec_tag_string,nb_read_frames -of default=nw=1 "${HW_TRACK:-<track>}"
    hw_read_quiet 'a full decode into nothing' "${HW_FFMPEG_PREFIX:-<ffmpeg-prefix>}/bin/ffmpeg" -hide_banner -nostdin -v error -i "${HW_TRACK:-<track>}" -f null -
    # shellcheck disable=SC2016
    hw_reduce 'length($0) > 0 { c++ } END { print c + 0 }'
    obs 'error lines of the full decode' "$HW_RED"
    obs 'exit code of the decode' "$HW_CODE"
    confirm 'whether a stored camera file can be read by the pinned tools directly, or only from an export (open point C of chapter 3)'
    ;;
esac
note 'what to record (part 6): per camera: codec set, codec in the connect line, sample entry; packets and frames; the three counters; anchoring mode; keyframe interval observed; clock offset in milliseconds and "advisory" yes or no; decode error lines.'
hw_done
