#!/bin/bash
# Hardware acceptance package: the writer of the result record (chapter 1, section 9.1).
#
#   record-line.sh --evidence DIR --check 9A/H-nn --run K --result PASS|FAIL|NOT-RUN
#                  --operation none|SIMULATED|REAL_DEVELOPMENT|REAL_PRODUCTION
#                  --recording -|S1|S2|S3|S4|generated --measured TEXT --bound TEXT
#                  --evidence-file NAME|- --role USER|TECH|OPER|BENCH [--note TEXT] [--dry]
#   record-line.sh --evidence DIR --list        the 27 checks in the order of the run, each with its lines
#
# It appends ONE line per call to <evidence-folder>/result-record.txt, in the form
#     check | run | result | operation | recording | measured | bound | evidence | reason or note
# and changes nothing else. An earlier line is never edited or removed: a repeated check gets a
# new line with the next run number. The RESULT IS THE USER'S: this script decides nothing, it
# writes what it is given. It starts no program at all (shell built-ins only).
#
# What it refuses, so that the record holds nothing chapter 1 forbids: a field with a character
# outside a closed set; a field that holds an address other than a loopback address, a hardware
# address, a locator (anything with ://), or a word such as password, secret, token or credential
# with a value behind it; a FAIL or NOT RUN without a reason; a second line for the same check and run;
# an evidence file name that is not in the evidence folder.
#
# NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
# Exit codes: 0 the line was written (or printed, with --dry; or the list printed); 2 refused;
# 3 not Ubuntu 24.04 and --dry not asked.
set -eu
HW_SCRIPT=record-line.sh
HW_CHECK='the result record'
HW_CHAPTER=1
HW_MODES=''
HW_ACCEPTS=''
HW_SUMMARY='one line of the result record per check'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"

# The 27 checks in the order of chapter 1, section 6.
ORDER='27 01 02 24 03 04 16 05 25 06 07 08 12 13 15 14 10 23 17 21 09 26 18 20 22 11 19'
RECORD_NAME=result-record.txt

R_DRY=0
R_LIST=0
R_CHECK=''
R_RUN=''
R_RESULT=''
R_OPERATION=''
R_RECORDING=''
R_MEASURED=''
R_BOUND=''
R_FILE=''
R_ROLE=''
R_NOTE=''

usage() {
  printf '%s\n' 'usage: record-line.sh --evidence DIR --check 9A/H-nn --run K --result PASS|FAIL|NOT-RUN --operation none|SIMULATED|REAL_DEVELOPMENT|REAL_PRODUCTION'
  printf '%s\n' '                      --recording -|S1|S2|S3|S4|generated --measured TEXT --bound TEXT --evidence-file NAME|- --role USER|TECH|OPER|BENCH [--note TEXT] [--dry]'
  printf '%s\n' '       record-line.sh --evidence DIR --list'
  printf '%s\n' 'One line per call, appended to result-record.txt in the evidence folder. Never a password, a key, a token,'
  printf '%s\n' 'a stream address, a real network address, a personal name, a frame or a sound (chapter 1, section 9.1).'
  printf '%s\n' 'The result is the USER'"'"'s. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the package.'
}

# A free-text field: a closed character set, and nothing the record must not hold.
check_text() { # check_text <option> <value>
  local re='^[A-Za-z0-9 .,;:()/+_=<>%-]{1,240}$'
  local ip='(^|[^0-9.])([0-9]{1,3})\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}([^0-9]|$)'
  local mac='[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}'
  local named='(pass|passwd|password|secret|token|credential)[a-z_-]*[ ]*[=:][ ]*[^ ]'
  [[ $2 =~ $re ]] || hw_fail 2 "refused: $1 may hold letters, digits, spaces and . , ; : ( ) / + _ = < > % - only, 1 to 240 characters. Nothing was written."
  case "$2" in *://*) hw_fail 2 "refused: $1 holds a locator (://). A stream address or a link is never written into the record. Nothing was written." ;; esac
  if [[ $2 =~ $mac ]]; then hw_fail 2 "refused: $1 holds a hardware address. Nothing was written."; fi
  if [[ $2 =~ $ip ]]; then
    if [ "${BASH_REMATCH[2]}" != 127 ]; then hw_fail 2 "refused: $1 holds a network address. No real address is written into the record. Nothing was written."; fi
  fi
  shopt -s nocasematch
  if [[ $2 =~ $named ]]; then
    shopt -u nocasematch
    hw_fail 2 "refused: $1 names a password, secret, token or credential with a value. Nothing was written."
  fi
  shopt -u nocasematch
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry | --print-only) R_DRY=1 ;;
    --list) R_LIST=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    --evidence | --check | --run | --result | --operation | --recording | --measured | --bound | --evidence-file | --role | --note)
      if [ $# -lt 2 ]; then hw_fail 2 "refused: $1 needs a value. Nothing was written."; fi
      case "$1" in
        --evidence)
          hw_check_path "$1" "$2"
          HW_EVIDENCE=$2
          ;;
        --check)
          re='^9A/H-(0[1-9]|1[0-9]|2[0-7])$'
          [[ $2 =~ $re ]] || hw_fail 2 'refused: --check is 9A/H-01 to 9A/H-27. Nothing was written.'
          R_CHECK=$2
          ;;
        --run)
          hw_check_number "$1" "$2" 2
          R_RUN=$2
          ;;
        --result)
          case "$2" in
            PASS | FAIL) R_RESULT=$2 ;;
            NOT-RUN | 'NOT RUN') R_RESULT='NOT RUN' ;;
            *) hw_fail 2 'refused: --result is exactly one of PASS, FAIL, NOT-RUN. "Partial" is a word of the summary, not of a line. Nothing was written.' ;;
          esac
          ;;
        --operation)
          case "$2" in none | SIMULATED | REAL_DEVELOPMENT | REAL_PRODUCTION) R_OPERATION=$2 ;; *) hw_fail 2 'refused: --operation is none, SIMULATED, REAL_DEVELOPMENT or REAL_PRODUCTION. Nothing was written.' ;; esac
          ;;
        --recording)
          case "$2" in - | S1 | S2 | S3 | S4 | generated) R_RECORDING=$2 ;; *) hw_fail 2 'refused: --recording is -, S1 to S4, or generated. Nothing was written.' ;; esac
          ;;
        --measured)
          check_text "$1" "$2"
          R_MEASURED=$2
          ;;
        --bound)
          check_text "$1" "$2"
          R_BOUND=$2
          ;;
        --note)
          check_text "$1" "$2"
          R_NOTE=$2
          ;;
        --evidence-file)
          re='^(-|[A-Za-z0-9][A-Za-z0-9._-]{0,99})$'
          [[ $2 =~ $re ]] || hw_fail 2 'refused: --evidence-file is a file name of the evidence folder (no folder part), or -. Nothing was written.'
          R_FILE=$2
          ;;
        --role)
          case "$2" in USER | TECH | OPER | BENCH) R_ROLE=$2 ;; *) hw_fail 2 'refused: --role is USER, TECH, OPER or BENCH: a role, never a name. Nothing was written.' ;; esac
          ;;
      esac
      shift
      ;;
    *) hw_fail 2 'refused: unknown option (see --help). No option takes a password, a key or a token. Nothing was written.' ;;
  esac
  shift
done

if [ "$R_DRY" != 1 ]; then
  if ! hw_os_is_expected; then
    hw_fail 3 'refused: the record is written on the Ubuntu 24.04 acceptance host, and /etc/os-release does not name one. Nothing was read, nothing was written. --dry prints the line.'
  fi
  if [ "${EUID:-1}" -eq 0 ]; then hw_fail 3 'refused: the record writer is not run as root. Nothing was written.'; fi
  [ -n "$HW_EVIDENCE" ] || hw_fail 2 'refused: --evidence DIR is needed. Nothing was written.'
  if [ ! -d "$HW_EVIDENCE" ] || [ ! -w "$HW_EVIDENCE" ]; then hw_fail 2 'refused: --evidence does not name an existing folder this account can write to. Nothing was written.'; fi
  if [ -e "$HW_EVIDENCE/.git" ] || [ -e "$HW_EVIDENCE/package.json" ]; then hw_fail 2 'refused: the evidence folder must lie outside the repository. Nothing was written.'; fi
fi
RECORD="$HW_EVIDENCE/$RECORD_NAME"

if [ "$R_LIST" = 1 ]; then
  printf '%s\n' '# the result record, in the order of chapter 1, section 6 (a listing; nothing is written, nothing is judged)'
  if [ "$R_DRY" = 1 ]; then
    printf '%s\n' '# mode: DRY. Would read result-record.txt of the evidence folder and print, per check, its lines or "no line yet".'
    exit 0
  fi
  total=0
  missing=0
  for n in $ORDER; do
    found=0
    if [ -f "$RECORD" ]; then
      while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
          "9A/H-$n | "*)
            found=$((found + 1))
            printf '%s\n' "$line"
            ;;
        esac
      done <"$RECORD"
    fi
    if [ "$found" = 0 ]; then
      missing=$((missing + 1))
      printf '%s\n' "9A/H-$n | - | no line yet"
    fi
    total=$((total + found))
  done
  printf '%s\n' "-- lines in the record: $total; checks without a line: $missing of 27 (the summary of section 9.4 and the ruling are the USER's)"
  exit 0
fi

for pair in "check:$R_CHECK" "run:$R_RUN" "result:$R_RESULT" "operation:$R_OPERATION" "recording:$R_RECORDING" "measured:$R_MEASURED" "bound:$R_BOUND" "evidence-file:$R_FILE" "role:$R_ROLE"; do
  if [ -z "${pair#*:}" ]; then hw_fail 2 "refused: --${pair%%:*} is needed (a field with nothing to say takes -). Nothing was written."; fi
done
if [ "$R_RESULT" != PASS ] && [ -z "$R_NOTE" ]; then
  hw_fail 2 'refused: a FAIL needs what was seen instead, a NOT RUN needs the missing precondition, action or value (--note). Nothing was written.'
fi
if [ "$R_DRY" != 1 ] && [ "$R_FILE" != - ] && [ ! -f "$HW_EVIDENCE/$R_FILE" ]; then
  hw_fail 2 'refused: --evidence-file does not name a file of the evidence folder (a collector prints the name to use; a hand-written note is saved there first). Nothing was written.'
fi

LINE="$R_CHECK | $R_RUN | $R_RESULT | $R_OPERATION | $R_RECORDING | $R_MEASURED | $R_BOUND | $R_FILE ($R_ROLE) | ${R_NOTE:--}"

if [ "$R_DRY" = 1 ]; then
  printf '%s\n' '# mode: DRY. Nothing is written. The line would be:'
  printf '%s\n' "$LINE"
  exit 0
fi

if [ -f "$RECORD" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      "$R_CHECK | $R_RUN | "*) hw_fail 2 "refused: the record already holds a line for $R_CHECK run $R_RUN. An earlier line is kept; a repeated check takes the next run number. Nothing was written." ;;
    esac
  done <"$RECORD"
else
  {
    printf '%s\n' '# DEMS Core hardware acceptance: result record (chapter 1, section 9.1). One line per check and run; lines are only ever added.'
    printf '%s\n' '# check | run | result | operation | recording | measured | bound | evidence | reason or note'
    printf '%s\n' '# The header of section 9.1 (date, commit, host, cameras, B-1 to B-6, UA-6, UA-7, schema version, roles) and the summary of 9.4 are written by the USER.'
  } >"$RECORD"
fi
printf '%s\n' "$LINE" >>"$RECORD"
printf '%s\n' "written to $RECORD_NAME: $LINE"
