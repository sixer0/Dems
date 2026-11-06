#!/bin/bash
# Hardware acceptance, check 9A/H-07 (chapter 2): the real card listing; the same identity after
# a re-plug.
#   --host [--service-user U] [--sudo-reads FILE]       step .1
#   --audit --audit-file FILE                                 step .7
# Searching, registering and re-plugging are steps of TECH and BENCH. This collector opens no
# sound device (it reads /proc/asound and lsusb).
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h07.sh
HW_CHECK='9A/H-07'
HW_CHAPTER=2
HW_MODES='host audit'
HW_ACCEPTS='service-user sudo-reads audit-file'
HW_SUMMARY='the sound cards as the kernel lists them and their capture channel counts; the audit entries of search and registration'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"

criterion '1. the channel count the Core lists equals the count of /proc/asound and the count the interface'"'"'s own documentation states: 3 equal figures; 2. inputs registered without a person'"'"'s action: 0; 3. devices after three registrations of two inputs: 2; 4. an input beyond the card refused by name: 1 of 1; 5. identity after the re-plug on the same port: card id, USB id and channel count equal, 3 of 3; CARD_CHANGED entries: 0.'
case "$HW_MODE" in
  host)
    step '9A/H-07.1' SCRIPT 'lsusb reduced to the vendor and product id of the audio interface; cat /proc/asound/cards; the capture channel count from /proc/asound/card<N>/stream0; arecord -l as the service user (by the USER); id -nG <service-user>'
    expected 'the interface is listed with the driver USB-Audio; arecord -l as the service user lists it as a card; the service user'"'"'s groups hold audio.'
    hw_read_quiet 'USB devices' lsusb
    if [ "$HW_DRY" != 1 ]; then
      # Vendor and product id and the product words only; hubs are left out. No serial number is in this listing.
      # shellcheck disable=SC2016
      printf '%s\n' "$HW_TEXT" | awk '$5 == "ID" && tolower($0) !~ /hub/ { out = $6; for (i = 7; i <= NF; i++) out = out " " $i; print out }' | hw_block '   usb id  '
      note 'the audio interface is the line whose id the Core lists in step .2; the USER names it'
    fi
    hw_fixed_file 'the sound cards the kernel lists' /proc/asound/cards
    if [ "$HW_DRY" != 1 ] && [ -n "$HW_TEXT" ]; then
      # A card line holds the card number, its id and its driver. The second line of a card (its long name
      # with the USB path) is left out: some devices write a serial number there.
      # shellcheck disable=SC2016
      printf '%s\n' "$HW_TEXT" | awk '$1 ~ /^[0-9]+$/ { print }' | hw_block '   card    '
      # shellcheck disable=SC2016
      hw_reduce '$1 ~ /^[0-9]+$/ { c++; if (index($0, "USB-Audio") > 0) u++ } END { print (c + 0) "; with the driver USB-Audio: " (u + 0) }'
      obs 'cards' "$HW_RED"
    fi
    for n in 0 1 2 3 4 5 6 7; do
      if [ "$HW_DRY" = 1 ]; then
        if [ "$n" = 0 ]; then hw_line '   would-read-file: /proc/asound/card<N>/stream0 for N = 0 to 7 where it exists (the capture channel counts only)'; fi
        continue
      fi
      if [ -r "$HW_ROOT/proc/asound/card$n/stream0" ]; then
        HW_READ_COUNT=$((HW_READ_COUNT + 1))
        # shellcheck disable=SC2016
        channels=$(awk '/^Capture:/ { cap = 1; next } /^Playback:/ { cap = 0 } cap && $1 == "Channels:" { if (!seen[$2]++) list = list " " $2 } END { print (list == "" ? " none" : list) }' "$HW_ROOT/proc/asound/card$n/stream0")
        obs "card $n: capture channel counts of its USB stream" "$channels"
      fi
    done
    hw_read_quiet 'groups of the service user (HOST-26)' id -nG "${HW_SERVICE_USER:-<service-user>}"
    # shellcheck disable=SC2016
    hw_reduce '{ for (i = 1; i <= NF; i++) if ($i == "audio") a = 1 } END { print (a ? "yes" : "no") }'
    obs 'the groups of the service user hold audio' "$HW_RED"
    user_step 'sudo runuser -u <service-user> -- arecord -l     (lists the interface as a card; into the file for --sudo-reads)'
    hw_handed 'arecord -l as the service user' "$HW_SUDO_READS" 'pass the file with --sudo-reads'
    ;;
  audit)
    step '9A/H-07.7' SCRIPT 'the count of audit entries of the types CAPTURE_DISCOVERY_SEARCHED (scope AUDIO_CARDS) and CAPTURE_AUDIO_INPUT_CHANGED since step .2, each with its change code'
    expected 'searches: 4 entries (5 or 6 with step .8); CAPTURE_AUDIO_INPUT_CHANGED: 2 entries with the code REGISTERED, and for the third registration either 0 entries or 1 with REENABLED; entries with the code CARD_CHANGED after step .6: 0.'
    user_step 'save the audit list since step .2 as a text file, one entry per line, and pass it with --audit-file'
    if hw_log_needed --audit-file "$HW_AUDIT"; then
      hw_count 'audit list' "${HW_AUDIT:-<audit>}" CAPTURE_DISCOVERY_SEARCHED AUDIO_CARDS CAPTURE_AUDIO_INPUT_CHANGED REGISTERED REENABLED CARD_CHANGED
      confirm 'that an entry of a search holds its scope and an entry of a registration its change code on the same line'
    fi
    ;;
esac
note 'what to record (part 6): the interface'"'"'s model name (into the header); the three channel figures; the counts of criterion 2 to 5; the observation of step .8; which input numbers are sockets. Not: the card'"'"'s serial number.'
hw_done
