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
    step '9A/H-09.1' SCRIPT 'per camera: from the worker'"'"'s log, the connect line (codec, picture size, parameter-set length), the count of lines INGEST_NO_EXTRADATA, the anchoring mode, the observed keyframe interval, and the line that sums the camera up (video packets, fragments, and its three counters); from the session, the clock offset of the camera in milliseconds and whether the advisory was raised'
    expected 'per camera: codec hevc for a camera set to H.265; INGEST_NO_EXTRADATA: 0 lines; one summing line with video packets above 0; a clock offset of at most 2,000 ms.'
    if hw_log_needed --worker-log "$HW_WORKER_LOG"; then
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" ingest_connected port codec width height extradata
      hw_count 'worker log' "${HW_WORKER_LOG:-<worker-log>}" INGEST_NO_EXTRADATA
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" anchored cam mode offset_us
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" keyframe_interval cam interval_ms frames
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" camera_summary cam video_packets fragments dropped_no_pts dropped_prestart retimed
      note 'the three counters read here are those of the worker'"'"'s summing line: dropped_no_pts, dropped_prestart, retimed (open point B of chapter 3). In --live the summing line does not exist yet.'
      confirm 'the names of the worker'"'"'s lines for the anchoring mode and the observed keyframe interval'
    fi
    if [ -n "$HW_CORE_LOG" ] || [ "$HW_DRY" = 1 ]; then
      hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAMERA_CLOCK_OFFSET deviceId offsetMs clockOffsetMs
      hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" CAMERA_CLOCK_OFFSET
      confirm 'the field that holds a camera'"'"'s clock offset in milliseconds; the advisory itself is read by OPER on the monitor (step .3)'
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
