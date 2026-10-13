#!/bin/bash
# Hardware acceptance, check 9A/H-25 (chapter 2): the conflict check refuses an address that
# another device holds.
#   --tool                               step .1: which arping is installed, and where
#   --state --camera-interface IF        step .3 (and the readings of step .4): the addresses on the camera port
# The requests to the helper (steps .2 and .4) are the USER's. This collector runs no arping.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h25.sh
HW_CHECK='9A/H-25'
HW_CHAPTER=2
HW_MODES='tool state'
HW_ACCEPTS='camera-interface at'
HW_SUMMARY='the conflict-check tool and its package; the count of addresses on the camera port'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"

criterion 'The tool is the iputils one at the stated path: 1 of 1. An address in use refused: 1 of 1, address not added. The free control added and removed: 1 of 1 each.'
case "$HW_MODE" in
  tool)
    step '9A/H-25.1' SCRIPT 'command -v arping; dpkg -S on that path; dpkg -s arping; stat -c "%U %a" on /usr/bin/arping and /usr/sbin/ip'
    expected '/usr/bin/arping; iputils-arping: /usr/bin/arping; "is not installed" for the package named arping; both tools owned by root, not writable by group or others.'
    if [ "$HW_DRY" = 1 ]; then
      hw_line '   would-look-up: command -v arping (a shell built-in; nothing is started)'
      found=/usr/bin/arping
    else
      found=$(command -v arping 2>/dev/null) || found=''
      obs 'command -v arping' "${found:-not found on the path}"
    fi
    hw_read 'the package that owns the tool' dpkg -S "${found:-/usr/bin/arping}"
    hw_read 'the other package named arping' dpkg -s arping
    hw_read 'owner and mode of the two tools the helper calls' stat -c '%U %a %n' /usr/bin/arping /usr/sbin/ip
    ;;
  state)
    step '9A/H-25.3' SCRIPT 'ip -br -4 addr show dev <camera-interface>'
    expected '.3: one address on the camera port. .4: two addresses, the second with a lifetime of at most 300 s; then one address.'
    if [ "$HW_DRY" != 1 ] && [ -z "$HW_CAMERA_INTERFACE" ]; then hw_fail 2 'refused: --state needs --camera-interface. Nothing more was read.'; fi
    hw_read_quiet 'addresses on the camera port' ip -4 addr show dev "${HW_CAMERA_INTERFACE:-<camera-interface>}"
    # shellcheck disable=SC2016
    hw_reduce '$1 == "inet" { c++ } $1 == "valid_lft" { life = life " " $2 } END { print (c + 0) "; valid_lft of each:" (life == "" ? " (none)" : life) }'
    obs 'addresses on the camera port' "$HW_RED"
    note 'no address is printed. For the readings of step .4 run this mode again with the next --at label (--at 1, --at 2, --at 3) so that each reading has its own file.'
    ;;
esac
note 'what to record (part 6): the three tool lines; the answer of .2; the address counts 1, 2, 1. Not: the two addresses.'
hw_done
