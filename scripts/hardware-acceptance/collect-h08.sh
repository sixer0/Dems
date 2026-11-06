#!/bin/bash
# Hardware acceptance, check 9A/H-08 (chapter 2): shared capture opens on both inputs; rate;
# audible level on both.
#   --config --alsa-config FILE                                                         step .2
#   --session S1 --core-pid N [--core-log FILE] [--worker-log FILE]                     step .6 (during S1)
#   --first-second S1 --track FILE --ffmpeg-prefix P                                    step .7 (after S1 is sealed)
# --alsa-config: a copy of the shared-capture configuration the Core generated under its run
# directory, handed over by the USER (sudo cat). --track: the audio of S1 in a file this account
# can read (from an export of the session, or a copy the USER makes); it is DECODED INTO NOTHING
# and two numbers are printed. No sound leaves the host, and no device is opened.
# NAMES (wave 12, row C1; each checked against the product source on 2026-10-14):
#   the helper's argument row is `-f alsa -c:a pcm_s24le -ch_layout <n>C -sample_rate 48000 -i <device>
#   -af pan=mono|c0=c<k>` (apps/core-server/src/capture/adapters/local/mic-helper-args.ts). The row
#   never holds -channels, -ac, -ar, -filter:a or -map_channel: the searches for those were removed.
#   The Core's words for a failed open are those of usb-audio-production.ts; the searches for
#   MIC_OPEN_FAILED, AUDIO_DEVICE_BUSY, MIC_HELPER_EXITED, MIC_NOT_CONNECTED and MIC_NOT_DELIVERING were
#   removed, the product never emitted them. The worker's line `audio_started` states no rate (its
#   members are t0_real_us, encoders, quantum_samples, master_mic, movflags): the fields sample_rate
#   and rate were removed; the rate is the -sample_rate of the helper's row.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h08.sh
HW_CHECK='9A/H-08'
HW_CHAPTER=2
HW_MODES='config session first-second'
HW_SESSION_MODES='session first-second'
HW_ACCEPTS='alsa-config core-pid core-log worker-log track ffmpeg-prefix'
HW_SUMMARY='the shared-capture configuration; the two microphone helper processes of S1; the peak of the first second of S1'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"

criterion '1. shared capture opens on both inputs at the same time: meters 2 of 2 at step .3, helper processes 2 of 2 at step .6, busy or failed opens 0; 2. the rate stated for the microphone equals 48,000 Hz, the rate asked for; 3. the level meets B-7 on both inputs: 2 of 2; with the other microphone unplugged, the unplugged input does not rise more than 6 dB above its silence figure: 2 of 2; 4. the first-second reading has a recorded result (two figures); 5. speech in the played-back S1 is heard: 1 of 1.'
note 'a silent input is a FAIL here, not a note (chapter 2). Bound B-7 is set by the USER before the run; this collector prints figures and holds them against nothing.'
case "$HW_MODE" in
  config)
    step '9A/H-08.2' SCRIPT 'the shared-capture configuration the Core generated under its run directory, reduced to: the number of dsnoop blocks, and per block the channel count, the rate, the sample format, the period and buffer sizes'
    expected 'one dsnoop block for the card: channels equal to the native count of 9A/H-07; rate 48000; the first format of S32_LE, S24_3LE, S24_LE, S16_LE that the card lists; period 1024, buffer 8192.'
    user_step "sudo find <data-dir>/run -name '*.conf' -print ; then sudo cat <that file> > <copy>     (pass the copy with --alsa-config)"
    if hw_log_needed --alsa-config "$HW_ALSA_CONFIG"; then
      if [ "$HW_DRY" = 1 ]; then
        hw_line '   would-read: the count of "type dsnoop" lines and every line that sets channels, rate, format, period_size or buffer_size (numbers and format names only)'
      else
        HW_READ_COUNT=$((HW_READ_COUNT + 1))
        # shellcheck disable=SC2016
        awk '
          $1 == "type" && $2 ~ /^dsnoop;?$/ { blocks++ }
          $1 ~ /^(channels|rate|format|period_size|buffer_size)$/ { v = $2; sub(/;$/, "", v); if (v ~ /^[A-Za-z0-9_]+$/) print $1 " " v }
          END { print "dsnoop blocks: " blocks + 0 }' "$HW_ALSA_CONFIG" | while IFS= read -r line; do hw_line "      config  | $line"; done
      fi
    fi
    ;;
  session)
    step '9A/H-08.6' SCRIPT 'during S1: the two microphone helper processes with their argument lists reduced to the format, the channel count, the rate and the channel selection; any line that reports a failed or busy audio open; the rate the worker states for the microphone'
    expected 'two helper processes, both alive, each opened with the card'"'"'s native channel count (written -ch_layout <native count>C), format alsa, -sample_rate 48000 and a selection of one channel; failed or busy opens: 0; the rate is 48,000 Hz.'
    if [ "$HW_DRY" != 1 ] && [ -z "$HW_CORE_PID" ]; then hw_fail 2 'refused: --session needs --core-pid. Nothing more was read.'; fi
    hw_read_quiet 'process table' ps -eo pid=,ppid=,comm=
    # shellcheck disable=SC2016
    hw_reduce '
      { pid[NR] = $1; parent[$1] = $2; name[$1] = $3 }
      END {
        want[core] = 1; changed = 1
        while (changed) { changed = 0; for (i = 1; i <= NR; i++) if (!(pid[i] in want) && (parent[pid[i]] in want)) { want[pid[i]] = 1; changed = 1 } }
        for (i = 1; i <= NR; i++) if ((pid[i] in want) && pid[i] != core && name[pid[i]] ~ /^ffmpeg/) print pid[i]
      }' -v core="${HW_CORE_PID:-0}"
    if [ "$HW_DRY" = 1 ]; then
      hw_line '   would-read-file: /proc/<pid>/cmdline of every descendant of the Core named ffmpeg, reduced to the values after -f, -ch_layout (the channel count, as <n>C), -sample_rate, and the channel selection (-af)'
    else
      helpers=0
      while read -r pid; do
        [ -n "$pid" ] || continue
        helpers=$((helpers + 1))
        if [ ! -r "$HW_ROOT/proc/$pid/cmdline" ]; then
          HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
          hw_line "   NOT COLLECTED: /proc/$pid/cmdline is not readable by this account"
          continue
        fi
        HW_READ_COUNT=$((HW_READ_COUNT + 1))
        previous=''
        picked=''
        value_re='^[A-Za-z0-9_=|.:+*,-]{1,80}$'
        while IFS= read -r -d '' arg || [ -n "$arg" ]; do
          case "$previous" in
            -f | -ch_layout | -sample_rate | -af)
              if [[ $arg =~ $value_re ]]; then picked="$picked $previous $arg"; else picked="$picked $previous [not printed]"; fi
              ;;
          esac
          previous=$arg
        done <"$HW_ROOT/proc/$pid/cmdline"
        hw_line "   helper process $pid:${picked:- none of the four arguments found}"
      done <<LIST
$HW_RED
LIST
      obs 'microphone helper processes (descendants of the Core named ffmpeg)' "$helpers"
    fi
    if [ -n "$HW_CORE_LOG" ] || [ "$HW_DRY" = 1 ]; then
      hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" AUDIO_HELPER_NOT_STARTED AUDIO_HELPER_ENDED_AT_START AUDIO_HELPER_EXITED AUDIO_NO_SAMPLE_WITHIN_BOUND AUDIO_SHARED_CAPTURE_REFUSED AUDIO_CARD_RATE_UNSUPPORTED AUDIO_CARD_MOVED
    fi
    if [ -n "$HW_WORKER_LOG" ] || [ "$HW_DRY" = 1 ]; then
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" session_starting mics
      hw_fields 'worker log' "${HW_WORKER_LOG:-<worker-log>}" audio_started encoders quantum_samples master_mic
      hw_count 'worker log' "${HW_WORKER_LOG:-<worker-log>}" MIC_INPUT_OPEN_FAILED MIC_SILENT MIC_DISCONNECTED
    fi
    confirm 'that a failed or busy open of a real card reaches the Core log under one of the seven codes counted here (they were seen on doubles only); the worker states no rate: quantum_samples is read beside the -sample_rate of the helper'"'"'s row'
    ;;
  first-second)
    step '9A/H-08.7' SCRIPT 'after S1 is sealed: from the sealed audio of S1, read-only, the peak of the first 1,000 ms and the peak of the following 4,000 ms, in dBFS. It prints two numbers and no sound.'
    expected 'two figures. A first-second peak more than 20 dB above the peak of the next four seconds, in a silent room, is the full-scale sample of the bench: a finding to record, it does not fail this check.'
    if [ "$HW_DRY" != 1 ]; then
      [ -n "$HW_TRACK" ] && [ -n "$HW_FFMPEG_PREFIX" ] || hw_fail 2 'refused: --first-second needs --track and --ffmpeg-prefix. Nothing more was read.'
    fi
    tool="${HW_FFMPEG_PREFIX:-<ffmpeg-prefix>}/bin/ffmpeg"
    track=${HW_TRACK:-<track>}
    hw_read_quiet 'peak of the first 1,000 ms (decoded into nothing)' "$tool" -hide_banner -nostdin -v info -t 1 -i "$track" -vn -af volumedetect -f null -
    # shellcheck disable=SC2016
    hw_reduce '/max_volume:/ { for (i = 1; i <= NF; i++) if ($i == "max_volume:") { print $(i + 1) " dB"; found = 1 } } END { if (!found) print "not stated" }'
    obs 'peak of the first 1,000 ms (relative to full scale)' "$HW_RED"
    hw_read_quiet 'peak of the following 4,000 ms (decoded into nothing)' "$tool" -hide_banner -nostdin -v info -ss 1 -t 4 -i "$track" -vn -af volumedetect -f null -
    # shellcheck disable=SC2016
    hw_reduce '/max_volume:/ { for (i = 1; i <= NF; i++) if ($i == "max_volume:") { print $(i + 1) " dB"; found = 1 } } END { if (!found) print "not stated" }'
    obs 'peak of the following 4,000 ms (relative to full scale)' "$HW_RED"
    confirm 'whether the stored audio of a sealed session can be read by the pinned tool directly or only from an export (open point C of chapter 3); the stored audio is AAC, so an exact full-scale test is not possible on it'
    ;;
esac
note 'what to record (part 6): B-7 as set; the six peak figures of steps .3 to .5 in dBFS; the configuration values of .2; helper processes and busy opens; the stated rate; the two first-second figures and whether the finding of .7 applies; "heard" yes or no. Not: any sound, any word that was spoken.'
hw_done
