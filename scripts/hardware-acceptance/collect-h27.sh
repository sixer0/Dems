#!/bin/bash
# Hardware acceptance, check 9A/H-27 (chapter 2): the host carries no input-av installation.
# Step 9A/H-27.6, the SCRIPT step: the process list filtered for mediamtx, uvicorn and nvr; the
# listening sockets on ports 8000, 8554 and 9997; getent passwd dems. Steps .1 to .5 need sudo
# and are the USER's; they are printed here as a reminder and never run.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h27.sh
HW_CHECK='9A/H-27'
HW_CHAPTER=2
HW_MODES=''
HW_ACCEPTS='service-user'
HW_SUMMARY='processes, listeners and the account of an input-av installation (step .6)'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"

criterion 'Findings: 0 in 6 of 6 steps.'

step '9A/H-27.1 to .5' USER 'the five readings with administrator rights; no collector runs them'
user_step "systemctl list-unit-files 'dems-nvr*' 'dems-mediamtx*'            -> the last line is: 0 unit files listed."
user_step 'sudo ls /usr/local/sbin/dems-netalias /etc/sudoers.d/dems-netalias  -> No such file or directory, twice'
user_step 'sudo grep -r -c netalias /etc/sudoers /etc/sudoers.d                -> 0 after every file name'
user_step 'sudo ls /etc/dems-nvr /etc/dems-nvr.env                             -> No such file or directory, twice'
user_step "sudo find / -xdev -name 'dems-alsa.conf' -print ; sudo grep -r -l ALSA_CONFIG_PATH /etc/environment /etc/systemd/system  -> nothing"

step '9A/H-27.6' SCRIPT 'the process list filtered for mediamtx, uvicorn and nvr; the listeners on ports 8000, 8554 and 9997; getent passwd dems'
expected '0 processes, 0 listeners on the three ports. getent prints nothing; if it prints an account, that account is not <service-user>.'
hw_read_quiet 'process list' ps -eo pid=,args=
for word in mediamtx uvicorn nvr; do
  # shellcheck disable=SC2016
  hw_reduce '{ line = tolower($0); if (index(line, w) > 0 && index(line, "collect-h27") == 0) c++ } END { print c + 0 }' -v w="$word"
  obs "processes whose command line holds $word" "$HW_RED"
done
hw_read_quiet 'listening TCP sockets' ss -H -ltn
for port in 8000 8554 9997; do
  # shellcheck disable=SC2016
  hw_reduce '{ if ($4 ~ (":" p "$")) c++ } END { print c + 0 }' -v p="$port"
  obs "listeners on port $port" "$HW_RED"
done
hw_read_quiet 'the account dems' getent passwd dems
# shellcheck disable=SC2016
hw_reduce '/^dems:/ { c++ } END { print c + 0 }'
obs 'accounts named dems' "$HW_RED"
if [ "$HW_DRY" != 1 ] && [ "$HW_RED" != 0 ]; then
  if [ -z "$HW_SERVICE_USER" ]; then
    note 'an account named dems exists; --service-user was not given, so "it is not <service-user>" is the USER to state'
  elif [ "$HW_SERVICE_USER" = dems ]; then
    obs 'the account dems is the service user' yes
  else
    obs 'the account dems is the service user' no
  fi
fi
note 'what to record (part 6): per step "0" or what was found, by kind only; this file name. Not a path under a home directory, not an account name other than dems.'
hw_done
