#!/bin/bash
# Hardware acceptance, checks 9A/H-18 and 9A/H-19 step .5 (chapter 3): the instant of a clap in
# the audio of a sealed session.
#   --session S1|S4 --clap HH:MM:SS --start HH:MM:SS --camera CAM-A --track FILE --ffmpeg-prefix P
# --clap: the host clock at the clap, as BENCH noted it; --start: the host clock at the click
# that started the session. --track: this camera's track in a file this account can read. The
# audio is decoded INTO NOTHING; the collector prints numbers only, no sound.
# The picture frame of the clap is read by OPER, frame by frame; the offset is the USER's sum.
# It takes no password as an argument, an environment variable or a file, and captures no packets.
# It prints codes, counts and figures: no stream address, no account name, no frame, no sound.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h18.sh
HW_CHECK='9A/H-18'
HW_CHAPTER=3
HW_MODES='session'
HW_SESSION_MODES='session'
HW_ACCEPTS='clap start camera track ffmpeg-prefix'
HW_SUMMARY='the time in the track of the sharpest rise of the audio level within 5 s around a clap'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"
criterion 'The magnitude of the offset is at most B-1 at the first clap and at the last clap, for both cameras: 4 of 4. All four values are recorded with their sign and the frame time. (For 9A/H-19: the magnitude of the drift is at most B-2 for both cameras: 2 of 2.)'
step '9A/H-18.1' SCRIPT 'per camera track and per clap: the time in the track, in milliseconds, of the sharpest rise of the audio level within 5 s around the given clock time. It prints numbers only.'
expected 'Four offsets of small magnitude; per camera the two are close to each other.'
if [ "$HW_DRY" = 1 ]; then
  hw_line '   would-compute: seconds from --start to --clap; the window from 5 s before to 5 s after it'
  hw_line '   would-read: <ffmpeg-prefix>/bin/ffmpeg -hide_banner -nostdin -v error -ss <window start> -t 10 -i <track> -vn -af asetnsamples=n=480:p=0,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.Peak_level:file=- -f null -'
  hw_line '   would-observe: the time in the track of the largest rise of the peak level between two blocks of 480 samples, in milliseconds, and the rise in dB'
else
  [ -n "$HW_CLAP" ] && [ -n "$HW_START" ] && [ -n "$HW_CAMERA" ] && [ -n "$HW_TRACK" ] && [ -n "$HW_FFMPEG_PREFIX" ] || hw_fail 2 'refused: --clap, --start, --camera, --track and --ffmpeg-prefix are needed. Nothing more was read.'
  hw_clock_seconds "$HW_CLAP"
  clap=$HW_RED
  hw_clock_seconds "$HW_START"
  begin=$HW_RED
  into=$((clap - begin))
  if [ "$into" -lt 0 ]; then into=$((into + 86400)); fi
  from=$((into - 5))
  if [ "$from" -lt 0 ]; then from=0; fi
  obs 'seconds from the start click to the clap, by the two host clock readings' "$into"
  hw_read_quiet 'peak level per block of 480 samples, 10 s around the clap (decoded into nothing)' "$HW_FFMPEG_PREFIX/bin/ffmpeg" -hide_banner -nostdin -v error -ss "$from" -t 10 -i "$HW_TRACK" -vn -af asetnsamples=n=480:p=0,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.Peak_level:file=- -f null -
  # shellcheck disable=SC2016
  hw_reduce '
    /pts_time:/ { for (i = 1; i <= NF; i++) if (index($i, "pts_time:") == 1) t = substr($i, 10) + 0 }
    /Peak_level=/ { v = $0; sub(/^.*Peak_level=/, "", v); if (v == "-inf") v = -120; v += 0; blocks++
      if (blocks > 1 && v - last > rise) { rise = v - last; at = t; level = v }
      last = v }
    END { if (blocks < 2) print "no level blocks were read"; else printf "%d ms in the track; rise %.1f dB to a peak of %.1f dB; blocks read %d\n", int((from + at) * 1000 + 0.5), rise, level, blocks }' -v from="$from"
  obs "sharpest rise of the audio level, ${HW_CAMERA}, clap at $HW_CLAP" "$HW_RED"
  note 'resolution of this reading: 10 ms (480 samples at 48,000 Hz). The picture is read frame by frame by OPER: at 25 frames per second its resolution is 40 ms.'
  confirm 'that the pinned ffmpeg carries the filters asetnsamples, astats and ametadata, and that -ss before -i restarts the block times at 0 (the window start is added back here)'
fi
note 'what to record (part 6): B-1; four offsets in milliseconds with sign; frame time per camera. Not: a frame or a sound.'
hw_done
