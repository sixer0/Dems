#!/bin/bash
# DEMS Core hardware acceptance package: the shared part of the collectors. SOURCED by the
# collect-hNN.sh scripts and record-line.sh beside it, never run by itself.
#
# NOTHING HERE IS PROVEN ON A HOST. Written on a development Mac; the collectors have run only
# there, against recording doubles of their tools and canned inputs. They are the INSTRUMENT of
# the hardware package (checks 9A/H-01 to 9A/H-27), not a result of it.
#
# Shell: bash, as Ubuntu 24.04 ships it (/bin/bash, 5.2); kept to what bash 3.2 also has, so that
# the dry mode and the tests run on the development Mac. Style of scripts/host/host-profile-lib.sh.
#
# Rules every collector follows (chapter 1, rule 6; chapters 2 and 3, section 1):
#   - it COLLECTS and PRINTS. It installs nothing, starts or stops no service, changes no
#     interface, no camera and no database, and writes ONE text file, only into the evidence
#     folder the user names with --evidence. It never overwrites a file;
#   - a reading tool is started only through hw_read, which refuses every tool and every verb
#     that is not on the closed list of hw_reader_allowed. No collector calls sudo: a reading
#     that needs administrator rights is a step of the USER, whose output is handed over as a
#     file (--sudo-reads and the other file options) and printed from there;
#   - no input is evaluated: /etc/os-release is read line by line and compared with fixed
#     words, every value on the command line must match a closed pattern, a value is only ever
#     one argument of a fixed command, and no file is read as shell text but this one;
#   - no secret is read, printed or stored. No option takes a password, a key or a token.
#     Every line a collector prints passes hw_mask: a credential-shaped value is replaced by a
#     marker and COUNTED, an address that is not a loopback address becomes its kind, a hardware
#     address becomes a marker, and the values the user gave (account, interface, folders) become
#     the placeholders of the host profile. A search for a secret in a log is the product's own
#     count-only scan (scripts/secret-scan/count-only.mjs): it prints numbers;
#   - the output names the check and the step, quotes the pass criterion from the chapter, and
#     states observations. It is NOT A VERDICT. Exit code 0 means "collected", never "passed":
#     the user and the result sheet decide.
#
# Dry mode (--dry): prints what would be read; starts no program, reads no file, writes no
# file. It is the only mode that runs off Ubuntu 24.04.
#
# Exit codes: 0 collected (or the dry listing printed); 2 wrong usage or a refused value;
# 3 refused: not Ubuntu 24.04 and --dry not asked; 5 the collector ran to its end but at least
# one reading could not be taken (named in the output). None of them is a result of a check.
#
# Test seam: HWA_TEST_DIR. When set, the fixed paths a collector reads (/etc/os-release, /proc,
# /run/dems-core-netalias) are taken under $HWA_TEST_DIR/root and the tools from
# $HWA_TEST_DIR/bin. Every output then carries the line "TEST DOUBLES IN USE": such a file is
# not a host reading and cannot pass for one.

HW_DRY=0
HW_EVIDENCE=''
HW_RUN=1
HW_MODE=''
HW_FILE_OPEN=0
HW_OUT_FILE=''
HW_READ_COUNT=0
HW_MISS_COUNT=0
HW_OUT=''
HW_CODE=0

# Values of the closed option set. Empty = not given.
HW_CORE_PID=''
HW_SERVICE_USER=''
HW_CAMERA_INTERFACE=''
HW_DATA_DIR=''
HW_INSTALL_DIR=''
HW_FFMPEG_PREFIX=''
HW_MEDIA_DIR=''
HW_CORE_LOG=''
HW_ERROR_LOG=''
HW_WORKER_LOG=''
HW_JOURNAL=''
HW_AUDIT=''
HW_SUDO_READS=''
HW_SESSION=''
HW_CAMERA=''
HW_CLAP=''
HW_START=''
HW_AT=''
HW_BEFORE_FILE=''
HW_SERIES_OUTPUT=''
HW_SERIES_DIR=''
HW_BOOT_LOG_1=''
HW_BOOT_LOG_2=''
HW_BOOT_LOG_3=''
HW_BOOT_LOG_4=''
HW_DATABASE=''
HW_PORT=''
HW_CODEC=''
HW_TRACK=''
HW_ALSA_CONFIG=''
HW_HWADDR_FILE=''
HW_PUSHER=''
HW_PROBE_SOURCE=''

# Set by each collector before hw_init.
HW_SCRIPT=${HW_SCRIPT:-collector}
HW_CHECK=${HW_CHECK:-}
HW_CHAPTER=${HW_CHAPTER:-}
HW_MODES=${HW_MODES:-}
HW_SESSION_MODES=${HW_SESSION_MODES:-}
HW_ACCEPTS=${HW_ACCEPTS:-}
HW_SUMMARY=${HW_SUMMARY:-}

if [ -n "${HWA_TEST_DIR:-}" ]; then
  HW_ROOT="$HWA_TEST_DIR/root"
  PATH="$HWA_TEST_DIR/bin"
else
  HW_ROOT=''
  PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
fi
export PATH

hw_fail() { # hw_fail <exit code> <message>
  printf '%s: %s\n' "$HW_SCRIPT" "$2" >&2
  exit "$1"
}

hw_usage() {
  local m
  printf '%s\n' "usage: $HW_SCRIPT [--dry] --evidence DIR [--run K]${HW_MODES:+ --<mode>} [inputs]"
  printf '%s\n' "  check: $HW_CHECK (chapter $HW_CHAPTER of the hardware acceptance package)"
  printf '%s\n' "  $HW_SUMMARY"
  if [ -n "$HW_MODES" ]; then
    printf '%s' '  modes (exactly one):'
    for m in $HW_MODES; do
      case " $HW_SESSION_MODES " in *" $m "*) printf ' --%s S<n>' "$m" ;; *) printf ' --%s' "$m" ;; esac
    done
    printf '\n'
  fi
  printf '%s\n' "  inputs this collector accepts: ${HW_ACCEPTS:-none}"
  printf '%s\n' '  --dry            print what would be read; read nothing, write nothing (runs anywhere)'
  printf '%s\n' '  --evidence DIR   an existing folder outside the repository and outside the data directory;'
  printf '%s\n' '                   the collector writes one new text file there and nothing else anywhere'
  printf '%s\n' '  --run K          the run number of the check (1 = first attempt); part of the file name'
  printf '%s\n' 'It reads only. It takes no password, no key and no token. Its exit code means "collected",'
  printf '%s\n' 'never "passed". NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the package.'
}

# --- closed forms of the values -------------------------------------------------------------

hw_check_user() {
  local re='^[a-z_][a-z0-9_-]{0,31}$'
  [[ $1 =~ $re ]] || hw_fail 2 'refused: --service-user must match [a-z_][a-z0-9_-]{0,31}'
  if [ "$1" = root ]; then hw_fail 2 'refused: --service-user must not be root'; fi
}

hw_check_path() { # hw_check_path <option> <value>
  local re='^/[A-Za-z0-9._/-]{1,240}$'
  [[ $2 =~ $re ]] || hw_fail 2 "refused: $1 must be an absolute path of letters, digits, dot, dash, underscore"
  case "$2" in
    */ | *//* | */./* | */. | */../* | */..) hw_fail 2 "refused: $1 must be a plain path (no //, no . or .. component, no trailing /)" ;;
  esac
}

hw_check_interface() {
  local re='^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$'
  [[ $1 =~ $re ]] || hw_fail 2 'refused: --camera-interface is not an interface name'
  if [ "$1" = lo ]; then hw_fail 2 'refused: --camera-interface must not be the loopback interface'; fi
}

hw_check_number() { # hw_check_number <option> <value> <max digits>
  local re="^[1-9][0-9]{0,$(($3 - 1))}\$"
  [[ $2 =~ $re ]] || hw_fail 2 "refused: $1 must be a positive number of at most $3 digits"
}

hw_check_clock() { # hw_check_clock <option> <value>
  local re='^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$'
  [[ $2 =~ $re ]] || hw_fail 2 "refused: $1 must be a host clock reading HH:MM:SS"
}

hw_check_session() {
  case "$1" in S1 | S2 | S3 | S4) ;; *) hw_fail 2 'refused: a session is named S1, S2, S3 or S4 (chapter 1, section 6)' ;; esac
}

hw_check_camera() {
  local re='^CAM-[A-Z]$'
  [[ $1 =~ $re ]] || hw_fail 2 'refused: --camera takes a housing label CAM-A to CAM-Z, never an address or a name'
}

hw_check_database() {
  local re='^dems_(demo|lane_[1-3])$'
  [[ $1 =~ $re ]] || hw_fail 2 'refused: --database takes dems_demo or dems_lane_1 to dems_lane_3 (the closed list of the product)'
}

hw_check_codec() {
  case "$1" in mpeg4 | libx264 | libopenh264 | copy) ;; *) hw_fail 2 'refused: --codec takes mpeg4, libx264, libopenh264 or copy' ;; esac
}

# A file the user hands over. Only its form is checked here; it is read later, as text, by awk.
hw_check_file() { # hw_check_file <option> <value>
  local re='^[A-Za-z0-9._/-]{1,255}$'
  [[ $2 =~ $re ]] || hw_fail 2 "refused: $1 must be a file path of letters, digits, dot, dash, underscore, slash"
  case "$2" in
    -* | */../* | ../* | */..) hw_fail 2 "refused: $1 must not begin with a dash or hold a .. component" ;;
  esac
  if [ "$HW_DRY" != 1 ]; then
    if [ ! -f "$2" ] || [ ! -r "$2" ]; then hw_fail 2 "refused: $1 does not name a readable file. Nothing was read."; fi
  fi
}

hw_accepts() { # hw_accepts <option name without dashes>
  case " $HW_ACCEPTS " in *" $1 "*) return 0 ;; esac
  hw_fail 2 "refused: this collector takes no --$1 (see --help). Nothing was read."
}

# Ubuntu 24.04 and nothing else. The file is read as text; it is never sourced.
hw_os_is_expected() {
  local id='' ver='' line
  [ -r "$HW_ROOT/etc/os-release" ] || return 1
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ID=ubuntu | 'ID="ubuntu"') id=ubuntu ;;
      VERSION_ID=24.04 | 'VERSION_ID="24.04"') ver=24.04 ;;
    esac
  done <"$HW_ROOT/etc/os-release"
  [ "$id" = ubuntu ] && [ "$ver" = 24.04 ]
}

hw_init() {
  local seen_dry=0 a name
  # --dry is found first, so that a file option given beside it is not opened.
  for a in "$@"; do
    case "$a" in --dry | --print-only) seen_dry=1 ;; esac
  done
  HW_DRY=$seen_dry
  while [ $# -gt 0 ]; do
    case "$1" in
      --dry | --print-only) ;;
      -h | --help)
        hw_usage
        exit 0
        ;;
      --evidence | --run | --core-pid | --service-user | --camera-interface | --data-dir | --install-dir | --ffmpeg-prefix | \
        --media-dir | --core-log | --error-log | --worker-log | --journal-file | --audit-file | --sudo-reads | --camera | --clap | --start | \
        --at | --before-file | --series-output | --series-dir | --boot-log | --database | --port | --codec | --track | \
        --alsa-config | --hw-address-file | --pusher | --probe-source)
        if [ $# -lt 2 ]; then hw_fail 2 "refused: $1 needs a value"; fi
        name=${1#--}
        case "$name" in evidence | run) ;; *) hw_accepts "$name" ;; esac
        case "$name" in
          evidence)
            hw_check_path "$1" "$2"
            HW_EVIDENCE=$2
            ;;
          run)
            hw_check_number "$1" "$2" 2
            HW_RUN=$2
            ;;
          core-pid)
            hw_check_number "$1" "$2" 7
            HW_CORE_PID=$2
            ;;
          service-user)
            hw_check_user "$2"
            HW_SERVICE_USER=$2
            ;;
          camera-interface)
            hw_check_interface "$2"
            HW_CAMERA_INTERFACE=$2
            ;;
          data-dir)
            hw_check_path "$1" "$2"
            HW_DATA_DIR=$2
            ;;
          install-dir)
            hw_check_path "$1" "$2"
            HW_INSTALL_DIR=$2
            ;;
          ffmpeg-prefix)
            hw_check_path "$1" "$2"
            HW_FFMPEG_PREFIX=$2
            ;;
          media-dir)
            hw_check_path "$1" "$2"
            HW_MEDIA_DIR=$2
            ;;
          series-dir)
            hw_check_path "$1" "$2"
            HW_SERIES_DIR=$2
            ;;
          pusher)
            hw_check_path "$1" "$2"
            HW_PUSHER=$2
            ;;
          core-log)
            hw_check_file "$1" "$2"
            HW_CORE_LOG=$2
            ;;
          error-log)
            hw_check_file "$1" "$2"
            HW_ERROR_LOG=$2
            ;;
          worker-log)
            hw_check_file "$1" "$2"
            HW_WORKER_LOG=$2
            ;;
          journal-file)
            hw_check_file "$1" "$2"
            HW_JOURNAL=$2
            ;;
          audit-file)
            hw_check_file "$1" "$2"
            HW_AUDIT=$2
            ;;
          sudo-reads)
            hw_check_file "$1" "$2"
            HW_SUDO_READS=$2
            ;;
          before-file)
            hw_check_file "$1" "$2"
            HW_BEFORE_FILE=$2
            ;;
          series-output)
            hw_check_file "$1" "$2"
            HW_SERIES_OUTPUT=$2
            ;;
          track)
            hw_check_file "$1" "$2"
            HW_TRACK=$2
            ;;
          alsa-config)
            hw_check_file "$1" "$2"
            HW_ALSA_CONFIG=$2
            ;;
          hw-address-file)
            hw_check_file "$1" "$2"
            HW_HWADDR_FILE=$2
            ;;
          probe-source)
            hw_check_file "$1" "$2"
            HW_PROBE_SOURCE=$2
            ;;
          boot-log)
            hw_check_file "$1" "$2"
            if [ -z "$HW_BOOT_LOG_1" ]; then
              HW_BOOT_LOG_1=$2
            elif [ -z "$HW_BOOT_LOG_2" ]; then
              HW_BOOT_LOG_2=$2
            elif [ -z "$HW_BOOT_LOG_3" ]; then
              HW_BOOT_LOG_3=$2
            elif [ -z "$HW_BOOT_LOG_4" ]; then
              HW_BOOT_LOG_4=$2
            else
              hw_fail 2 'refused: at most four --boot-log files'
            fi
            ;;
          camera)
            hw_check_camera "$2"
            HW_CAMERA=$2
            ;;
          clap)
            hw_check_clock "$1" "$2"
            HW_CLAP=$2
            ;;
          start)
            hw_check_clock "$1" "$2"
            HW_START=$2
            ;;
          at)
            hw_check_number "$1" "$2" 4
            HW_AT=$2
            ;;
          database)
            hw_check_database "$2"
            HW_DATABASE=$2
            ;;
          port)
            hw_check_number "$1" "$2" 5
            if [ "$2" -lt 1024 ] || [ "$2" -gt 65535 ]; then hw_fail 2 'refused: --port must be 1024 to 65535'; fi
            if [ "$2" -ge 8554 ] && [ "$2" -le 8564 ]; then hw_fail 2 'refused: --port must not be one of the camera listeners 8554 to 8564 (the loopback rule of HOST-25 guards them)'; fi
            HW_PORT=$2
            ;;
          codec)
            hw_check_codec "$2"
            HW_CODEC=$2
            ;;
        esac
        shift
        ;;
      --*)
        name=${1#--}
        case " $HW_MODES " in
          *" $name "*)
            if [ -n "$HW_MODE" ]; then hw_fail 2 'refused: exactly one mode (see --help). Nothing was read.'; fi
            HW_MODE=$name
            case " $HW_SESSION_MODES " in
              *" $name "*)
                if [ $# -lt 2 ]; then hw_fail 2 "refused: $1 needs a session (S1 to S4)"; fi
                hw_check_session "$2"
                HW_SESSION=$2
                shift
                ;;
            esac
            ;;
          *) hw_fail 2 'refused: unknown option (see --help). Nothing was read.' ;;
        esac
        ;;
      *) hw_fail 2 'refused: unknown argument (see --help). Nothing was read.' ;;
    esac
    shift
  done
  if [ -n "$HW_MODES" ] && [ -z "$HW_MODE" ]; then hw_fail 2 "refused: one mode is needed: $HW_MODES (each with two dashes). Nothing was read."; fi
  if [ "$HW_DRY" != 1 ]; then
    if ! hw_os_is_expected; then
      hw_fail 3 'refused: a collector reads an Ubuntu 24.04 acceptance host, and /etc/os-release does not name one. Nothing was read, nothing was written. --dry prints what would be read.'
    fi
    if [ "${EUID:-1}" -eq 0 ]; then
      hw_fail 3 'refused: a collector is not run as root (the administrator readings are steps of the USER, handed over as files). Nothing was read.'
    fi
    if [ -z "$HW_EVIDENCE" ]; then hw_fail 2 'refused: --evidence DIR is needed. Nothing was read.'; fi
    if [ ! -d "$HW_EVIDENCE" ] || [ ! -w "$HW_EVIDENCE" ]; then hw_fail 2 'refused: --evidence does not name an existing folder this account can write to. Nothing was read.'; fi
    case "$HW_EVIDENCE/" in
      "${HW_DATA_DIR:-/nonexistent-data-dir}"/*) hw_fail 2 'refused: the evidence folder must lie outside the data directory. Nothing was read.' ;;
    esac
    if [ -e "$HW_EVIDENCE/.git" ] || [ -e "$HW_EVIDENCE/package.json" ]; then hw_fail 2 'refused: the evidence folder must lie outside the repository. Nothing was read.'; fi
    hw_open_file
  fi
  hw_head
}

# The one file of this invocation: h<NN>-run<k>[-<mode>][-<session>][-<camera>][-<at>s][-clap<hhmmss>].txt
hw_file_name() {
  local n=${HW_CHECK#9A/H-} name
  name="h$n-run$HW_RUN"
  if [ -n "$HW_MODE" ]; then name="$name-$HW_MODE"; fi
  if [ -n "$HW_SESSION" ]; then name="$name-$HW_SESSION"; fi
  if [ -n "$HW_CAMERA" ]; then name="$name-$HW_CAMERA"; fi
  if [ -n "$HW_AT" ]; then name="$name-${HW_AT}s"; fi
  if [ -n "$HW_CLAP" ]; then name="$name-clap${HW_CLAP//:/}"; fi
  HW_OUT="$name.txt"
}

hw_open_file() {
  hw_file_name
  HW_OUT_FILE="$HW_EVIDENCE/$HW_OUT"
  if [ -e "$HW_OUT_FILE" ]; then
    hw_fail 2 "refused: $HW_OUT exists in the evidence folder; a repeated check takes the next --run. Nothing was read, nothing was overwritten."
  fi
  set -o noclobber
  exec 3>"$HW_OUT_FILE"
  set +o noclobber
  HW_FILE_OPEN=1
}

# --- printing -------------------------------------------------------------------------------

hw_line() { # hw_line <text>: one line, to the terminal and to the file. The text is the collector's own.
  printf '%s\n' "$1"
  if [ "$HW_FILE_OPEN" = 1 ]; then printf '%s\n' "$1" >&3; fi
}

# The mask every line of a tool, a /proc file or a handed-over file passes. An awk program:
# a pure text filter, it opens nothing but its standard input.
# shellcheck disable=SC2016
HW_AWK_MASK='
function swap(s, value, placeholder,   out, p) {
  if (value == "") return s
  out = ""
  while ((p = index(s, value)) > 0) { out = out substr(s, 1, p - 1) placeholder; s = substr(s, p + length(value)) }
  return out s
}
function octets_ok(a,   n, part, i) {
  n = split(a, part, ".")
  if (n != 4) return 0
  for (i = 1; i <= 4; i++) if (part[i] + 0 > 255 || length(part[i]) > 3) return 0
  return 1
}
function kind_of(a,   part) {
  split(a, part, ".")
  if (part[1] == 127) return a
  if (a == "0.0.0.0") return a
  if (part[1] == 10 || (part[1] == 172 && part[2] >= 16 && part[2] <= 31) || (part[1] == 192 && part[2] == 168)) return "[address:private]"
  if (part[1] == 169 && part[2] == 254) return "[address:link-local]"
  if (part[1] >= 224 && part[1] <= 239) return "[address:multicast]"
  return "[address:other]"
}
function mask(s,   out, m, scheme, name) {
  out = ""
  while (match(s, /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^ \t\/@:"]+:[^ \t\/@"]+@/)) {
    scheme = substr(s, RSTART, RLENGTH); sub(/:\/\/.*/, "", scheme)
    out = out substr(s, 1, RSTART - 1) scheme "://[masked-locator-credential]@"; s = substr(s, RSTART + RLENGTH)
  }
  s = out s; out = ""
  while (match(s, /(ses|dvc|bio)_[A-Za-z0-9_-]+/)) {
    if (RLENGTH >= 20) out = out substr(s, 1, RSTART - 1) "[masked-token]"; else out = out substr(s, 1, RSTART + RLENGTH - 1)
    s = substr(s, RSTART + RLENGTH)
  }
  s = out s; out = ""
  while (match(s, /rtsps?:\/\/[^ \t"\/]+\/[^ \t",|]+/)) {
    m = substr(s, RSTART, RLENGTH)
    out = out substr(s, 1, RSTART - 1) "rtsp://" (index(m, "[masked-locator-credential]") ? "[masked-locator-credential]@" : "") "[masked-stream-address]"; s = substr(s, RSTART + RLENGTH)
  }
  s = out s; out = ""
  while (match(s, /[A-Za-z0-9_-]*([Pp][Aa][Ss][Ss]|[Ss][Ee][Cc][Rr][Ee][Tt]|[Tt][Oo][Kk][Ee][Nn]|[Cc][Rr][Ee][Dd][Ee][Nn][Tt][Ii][Aa][Ll])[A-Za-z0-9_-]*"?[ \t]*[=:][ \t]*"?[^ \t,;"]+/)) {
    name = substr(s, RSTART, RLENGTH); sub(/"?[ \t]*[=:].*/, "", name)
    # The count lines of the count-only scan ("camera-credential: 0") are numbers, not values.
    if (name ~ /^(session-token|device-credential|biometric-token|camera-credential|ingest-secret)$/) out = out substr(s, 1, RSTART + RLENGTH - 1)
    else out = out substr(s, 1, RSTART - 1) name "=[masked-named-value]"
    s = substr(s, RSTART + RLENGTH)
  }
  s = out s; out = ""
  while (match(s, /([Aa]uthorization|[Bb]earer|[Dd]igest)[: ][^\n]*/)) {
    out = out substr(s, 1, RSTART - 1) "[masked-authorization]"; s = substr(s, RSTART + RLENGTH)
  }
  s = out s; out = ""
  while (match(s, /[0-9A-Fa-f][0-9A-Fa-f][:-][0-9A-Fa-f][0-9A-Fa-f][:-][0-9A-Fa-f][0-9A-Fa-f][:-][0-9A-Fa-f][0-9A-Fa-f][:-][0-9A-Fa-f][0-9A-Fa-f][:-][0-9A-Fa-f][0-9A-Fa-f]/)) {
    out = out substr(s, 1, RSTART - 1) "[hardware-address]"; s = substr(s, RSTART + RLENGTH)
  }
  s = out s; out = ""
  while (match(s, /[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/)) {
    m = substr(s, RSTART, RLENGTH)
    out = out substr(s, 1, RSTART - 1) (octets_ok(m) ? kind_of(m) : m); s = substr(s, RSTART + RLENGTH)
  }
  s = out s
  s = swap(s, evidence, "<evidence-folder>")
  s = swap(s, datadir, "<data-dir>")
  s = swap(s, mediadir, "<throw-away-media>")
  s = swap(s, installdir, "<install-dir>")
  s = swap(s, prefix, "<ffmpeg-prefix>")
  if (iface != "") s = swap(s, iface, "<camera-interface>")
  if (suser != "") s = swap(s, suser, "<service-user>")
  return s
}
'

hw_mask_run() { # hw_mask_run <awk body after the mask functions> [file]: prints masked lines behind "   output  | "
  local body=$1
  shift
  awk -v evidence="$HW_EVIDENCE" -v datadir="$HW_DATA_DIR" -v mediadir="$HW_MEDIA_DIR" -v installdir="$HW_INSTALL_DIR" \
    -v prefix="$HW_FFMPEG_PREFIX" -v iface="$HW_CAMERA_INTERFACE" -v suser="$HW_SERVICE_USER" "$HW_AWK_MASK $body" "$@"
}

# Prints the lines of standard input, masked, each behind a label.
hw_block() { # hw_block <label>
  local line
  if [ "$HW_DRY" = 1 ]; then
    # Dry mode starts no program, the mask included: the text is the collector's own command line.
    while IFS= read -r line || [ -n "$line" ]; do hw_line "   $1 | $line"; done
    return 0
  fi
  # shellcheck disable=SC2016
  hw_mask_run '{ print mask($0) }' | while IFS= read -r line || [ -n "$line" ]; do
    hw_line "   $1 | $line"
  done
}

hw_head() {
  local stamp='(dry: no clock read)'
  if [ "$HW_DRY" != 1 ]; then stamp=$(date '+%Y-%m-%d %H:%M:%S %z' 2>/dev/null || printf 'unknown'); fi
  hw_line "# $HW_SCRIPT   check $HW_CHECK   run $HW_RUN${HW_MODE:+   mode --$HW_MODE}${HW_SESSION:+   session $HW_SESSION}${HW_CAMERA:+   camera $HW_CAMERA}"
  hw_line "# chapter $HW_CHAPTER of the hardware acceptance package (scripts/hardware-acceptance/)"
  if [ "$HW_DRY" = 1 ]; then
    hw_line '# mode: DRY. Nothing is read, no program is started, no file is written. The lines below say what a run would read.'
  else
    hw_line "# mode: COLLECT. Read-only. Host clock at the start: $stamp. Output file: $HW_OUT"
  fi
  if [ -n "${HWA_TEST_DIR:-}" ]; then hw_line '# TEST DOUBLES IN USE: the tools and the fixed paths are stand-ins. This is NOT a host reading.'; fi
  hw_line '# NOT A VERDICT. This file states observations. The pass criterion is quoted from the chapter;'
  hw_line '# the USER holds the observations against it and writes the result line (record-line.sh).'
  hw_line '# NOTHING HERE IS PROVEN ON A HOST until the user has run it there: this is the instrument of the package.'
}

step() { # step <step id> <performer> <what the step reads, quoted from the chapter>
  hw_line ''
  hw_line "== $1  ($2)  $3"
}
expected() { hw_line "   expected (chapter $HW_CHAPTER, part 4): $1"; }
criterion() { hw_line "   pass criterion (chapter $HW_CHAPTER, part 5, quoted): $1"; }
note() { hw_line "   note    : $1"; }
confirm() { hw_line "   confirm : to confirm on the host (dry run of the package, row 130): $1"; }
obs() { # obs <name> <value>: the collector's own reading, a count or a fixed word
  if [ "$HW_DRY" = 1 ]; then hw_line "   would-observe: $1"; else hw_line "   observed: $1 = $2"; fi
}

# hw_reduce <awk program> [awk -v assignments...]: reduces the output of the last reading (HW_TEXT) to
# a count or a fixed word, in HW_RED. In dry mode it does nothing.
HW_RED=''
hw_reduce() {
  local program=$1
  shift
  HW_RED=''
  if [ "$HW_DRY" = 1 ]; then return 0; fi
  HW_RED=$(printf '%s\n' "$HW_TEXT" | awk "$@" "$program") || HW_RED='(reduction failed)'
}

# hw_proc_field <pid> <file> <awk pattern>: the matching lines of /proc/<pid>/<file>, masked.
hw_proc_lines() { # hw_proc_lines <label> <pid> <file under /proc/pid> <ERE>
  hw_fixed_file "$1" "/proc/$2/$3"
  if [ "$HW_DRY" = 1 ] || [ -z "$HW_TEXT" ]; then return 0; fi
  printf '%s\n' "$HW_TEXT" | awk -v re="$4" '$0 ~ re { print }' | hw_block '   output '
}
user_step() { hw_line "   USER    : $1"; }  # a step only the USER performs; printed, never run

# --- the closed list of reading tools ---------------------------------------------------------

# 0 when <tool> <arguments...> is a reading this package allows. Everything else is refused.
hw_reader_allowed() {
  local tool=$1
  shift
  case "$tool" in
    ss) case "${1:-}" in -H) return 0 ;; esac ;;
    ps) case "${1:-}" in -o | -axo | -eo) return 0 ;; esac ;;
    getent) case "${1:-}" in passwd | group) return 0 ;; esac ;;
    findmnt) case "${1:-}" in -no) return 0 ;; esac ;;
    stat) case "${1:-}" in -c) return 0 ;; esac ;;
    df) case "${1:-}" in -B1 | --output=avail,size) return 0 ;; esac ;;
    namei) case "${1:-}" in -l) return 0 ;; esac ;;
    sha256sum | lsusb | uname | lsb_release | ldd | nproc) return 0 ;;
    readlink) case "${1:-}" in -*) ;; *) return 0 ;; esac ;;
    id) case "${1:-}" in -nG | -u | -un) return 0 ;; esac ;;
    ldconfig) case "${1:-}" in -p) return 0 ;; esac ;;
    sysctl) case "${1:-}" in -n) return 0 ;; esac ;;
    timedatectl) case "${1:-}" in show) return 0 ;; esac ;;
    systemctl) case "${1:-}" in is-active | is-enabled | show | list-unit-files) return 0 ;; esac ;;
    dpkg) case "${1:-}" in -s | -S | -l) return 0 ;; esac ;;
    ip)
      case "$*" in
        '-br -4 addr show dev '* | '-4 addr show dev '* | '-4 route show default' | '-4 neigh show dev '*) return 0 ;;
      esac
      ;;
    node)
      case "$*" in
        --version | *'/scripts/secret-scan/count-only.mjs '*) return 0 ;;
      esac
      ;;
    npm)
      case "$*" in
        '--prefix '*' run db:status -- --database dems_'*) return 0 ;;
      esac
      ;;
    # The pinned media tools, by their absolute path: version and device listing, a probe of a file,
    # and a decode INTO NOTHING (-f null -): they read one file and write none.
    */bin/ffmpeg)
      case "$*" in
        '-hide_banner -version' | '-hide_banner -devices') return 0 ;;
        '-hide_banner -nostdin -v error -i '*' -f null -') return 0 ;;
        '-hide_banner -nostdin -v info '*' -vn -af volumedetect -f null -') return 0 ;;
        '-hide_banner -nostdin -v error '*' -vn -af asetnsamples=n=480:p=0,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.Peak_level:file=- -f null -') return 0 ;;
      esac
      ;;
    */bin/ffprobe)
      case "$*" in
        '-hide_banner -v error '*) return 0 ;;
      esac
      ;;
    make)
      case "$*" in
        '-C '*' versions') return 0 ;;
      esac
      ;;
  esac
  return 1
}

# hw_read <label> <tool> <argument>...: the ONLY place a reading tool is started.
# Sets HW_CODE to the tool's exit code and HW_TEXT to its output (unmasked, for a reducer).
HW_TEXT=''
hw_read() {
  local label=$1
  shift
  HW_TEXT=''
  HW_CODE=0
  if ! hw_reader_allowed "$@"; then
    hw_fail 2 "internal: refused to start a tool that is not on the closed list of readers: $1"
  fi
  if [ "$HW_DRY" = 1 ]; then
    printf '%s\n' "$*" | hw_block "would-read ($label)"
    return 0
  fi
  HW_READ_COUNT=$((HW_READ_COUNT + 1))
  printf '%s\n' "$*" | hw_block "command ($label)"
  if ! command -v "$1" >/dev/null 2>&1; then
    HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
    HW_CODE=127
    hw_line "   NOT COLLECTED: the tool $1 is not on this host's path; the USER takes this reading by hand and notes it"
    return 0
  fi
  HW_TEXT=$("$@" 2>&1) || HW_CODE=$?
  if [ -n "$HW_TEXT" ]; then
    printf '%s\n' "$HW_TEXT" | hw_block '   output '
  else
    hw_line '      output  | (nothing printed)'
  fi
  hw_line "      exit    : $HW_CODE"
}

# The same, but only a reduction of the output is printed (counts and fixed fields), never the lines.
hw_read_quiet() { # hw_read_quiet <label> <tool> <argument>...
  local label=$1
  shift
  HW_TEXT=''
  HW_CODE=0
  if ! hw_reader_allowed "$@"; then
    hw_fail 2 "internal: refused to start a tool that is not on the closed list of readers: $1"
  fi
  if [ "$HW_DRY" = 1 ]; then
    printf '%s\n' "$*" | hw_block "would-read ($label; reduced to counts, the lines are not printed)"
    return 0
  fi
  HW_READ_COUNT=$((HW_READ_COUNT + 1))
  printf '%s\n' "$*" | hw_block "command ($label; reduced, lines not printed)"
  if ! command -v "$1" >/dev/null 2>&1; then
    HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
    HW_CODE=127
    hw_line "   NOT COLLECTED: the tool $1 is not on this host's path; the USER takes this reading by hand and notes it"
    return 0
  fi
  HW_TEXT=$("$@" 2>&1) || HW_CODE=$?
  hw_line "      exit    : $HW_CODE"
}

# hw_fixed_file <label> <absolute path>: a fixed path of the system (/proc, /etc), read as text.
hw_fixed_file() {
  local path="$HW_ROOT$2"
  HW_TEXT=''
  if [ "$HW_DRY" = 1 ]; then
    printf '%s\n' "$2" | hw_block "would-read-file ($1)"
    return 0
  fi
  HW_READ_COUNT=$((HW_READ_COUNT + 1))
  printf '%s\n' "$2" | hw_block "file ($1)"
  if [ ! -r "$path" ] || [ ! -f "$path" ]; then
    HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
    hw_line '   NOT COLLECTED: not readable by this account (if it needs administrator rights, it is a step of the USER, handed over with --sudo-reads)'
    return 0
  fi
  HW_TEXT=$(awk '{ print }' "$path" 2>/dev/null) || HW_TEXT=''
}

# hw_handed <what> <file or empty> <the command the USER runs>: prints a handed-over file, masked.
hw_handed() {
  user_step "$3"
  if [ "$HW_DRY" = 1 ]; then
    hw_line "   would-print: the file the USER hands over for \"$1\", line by line, masked"
    return 0
  fi
  if [ -z "$2" ]; then
    HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
    hw_line "   NOT HANDED OVER: \"$1\" is missing from this collection; the USER notes the reading by hand"
    return 0
  fi
  HW_READ_COUNT=$((HW_READ_COUNT + 1))
  hw_line "   handed over by the USER for \"$1\":"
  # shellcheck disable=SC2016
  hw_mask_run '{ print mask($0) }' "$2" | while IFS= read -r line || [ -n "$line" ]; do hw_line "      handed  | $line"; done
}

# --- reading log files the USER hands over ------------------------------------------------------

# shellcheck disable=SC2016
HW_AWK_JSON='
function jget(line, key,   p, rest, v) {
  p = index(line, "\"" key "\":")
  if (!p) return ""
  rest = substr(line, p + length(key) + 3); sub(/^[ ]*/, "", rest)
  if (substr(rest, 1, 1) == "\"") { v = substr(rest, 2); sub(/".*/, "", v); return v }
  v = rest; sub(/[,}].*/, "", v); return v
}
function safe(v) {
  if (v == "") return "(absent)"
  if (v ~ /:\/\// || v ~ /@/) return "[address: not printed]"
  if (v ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/) return "[address: not printed]"
  if (length(v) > 48) return "[long value: not printed]"
  if (v !~ /^[A-Za-z0-9_.+ -]+$/) return "[text: not printed]"
  return v
}
function holds(line, word) { return index(line, "\"" word "\"") > 0 }
'

# hw_log_needed <option> <file>: 0 when the file was given; otherwise a NOT HANDED OVER line (1).
hw_log_needed() {
  if [ "$HW_DRY" = 1 ]; then return 0; fi
  if [ -n "$2" ]; then return 0; fi
  HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
  hw_line "   NOT HANDED OVER: $1 was not given; the readings from it are missing from this collection"
  return 1
}

# hw_count <what> <file> <word>...: per word, the number of lines of the file that hold it as a quoted
# value ("WORD") or as a word of its own. Prints counts only.
hw_count() {
  local what=$1 file=$2 word
  shift 2
  if [ "$HW_DRY" = 1 ]; then
    hw_line "   would-count ($what): lines that hold each of: $*"
    return 0
  fi
  HW_READ_COUNT=$((HW_READ_COUNT + 1))
  for word in "$@"; do
    # shellcheck disable=SC2016
    obs "$what: lines that hold $word" "$(awk -v w="$word" '
      { hit = 0; if (index($0, "\"" w "\"") > 0) hit = 1
        else { n = split($0, part, /[^A-Za-z0-9_]+/); for (i = 1; i <= n; i++) if (part[i] == w) hit = 1 }
        if (hit) c++ }
      END { print c + 0 }' "$file")"
  done
}

# hw_fields <what> <file> <word> <field>...: for every line that holds "WORD" as a quoted value, the
# named fields, each only when its value is a number or a short code (safe()); nothing else of the line.
hw_fields() {
  local what=$1 file=$2 word=$3
  shift 3
  if [ "$HW_DRY" = 1 ]; then
    hw_line "   would-read ($what): of every line that holds \"$word\": the fields $* (numbers and short codes only)"
    return 0
  fi
  HW_READ_COUNT=$((HW_READ_COUNT + 1))
  # shellcheck disable=SC2016
  awk -v w="$word" -v list="$*" "$HW_AWK_JSON"'
    BEGIN { n = split(list, f, " ") }
    holds($0, w) {
      c++; out = ""
      for (i = 1; i <= n; i++) out = out " " f[i] "=" safe(jget($0, f[i]))
      print c ":" out
    }
    END { print "count: " c + 0 }' "$file" | while IFS= read -r line || [ -n "$line" ]; do
    hw_line "      $what \"$word\" | $line"
  done
}

# hw_secret_scan <what> <file>...: the product's count-only scan over files the USER handed over.
# It prints the scan's own lines (numbers and file names), masked like every other line.
hw_secret_scan() {
  local what=$1 f given=''
  shift
  for f in "$@"; do
    if [ -n "$f" ]; then given="$given $f"; fi
  done
  if [ -z "$HW_INSTALL_DIR" ]; then
    if [ "$HW_DRY" != 1 ]; then
      HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
      hw_line "   NOT COLLECTED ($what): --install-dir is needed to find scripts/secret-scan/count-only.mjs"
      return 0
    fi
  fi
  if [ -z "$given" ] && [ "$HW_DRY" != 1 ]; then
    HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
    hw_line "   NOT COLLECTED ($what): no file was handed over to scan"
    return 0
  fi
  note 'the count-only scan prints a number per form (camera-credential, ingest-secret and four more) and the name of a file with a hit; never a line, never a value'
  # shellcheck disable=SC2086
  hw_read "$what" node "${HW_INSTALL_DIR:-<install-dir>}/scripts/secret-scan/count-only.mjs" ${given:-<the handed-over log files>}
  if [ "$HW_DRY" != 1 ]; then
    case "$HW_CODE" in
      0) obs "$what: count-only scan" 'TOTAL 0 (exit 0)' ;;
      1) obs "$what: count-only scan" 'AT LEAST ONE HIT (exit 1): a security finding; see the chapter, "If not met"' ;;
      *) obs "$what: count-only scan" "did not run (exit $HW_CODE)" ;;
    esac
  fi
}

# hw_count_part <what> <file> <text>...: per text, the number of lines that hold it anywhere (a part of a
# longer code counts). Prints counts only.
hw_count_part() {
  local what=$1 file=$2 word
  shift 2
  if [ "$HW_DRY" = 1 ]; then
    hw_line "   would-count ($what): lines that hold, anywhere, each of: $*"
    return 0
  fi
  HW_READ_COUNT=$((HW_READ_COUNT + 1))
  for word in "$@"; do
    # shellcheck disable=SC2016
    obs "$what: lines that hold $word" "$(awk -v w="$word" 'index($0, w) > 0 { c++ } END { print c + 0 }' "$file")"
  done
}

# hw_addresses <interface>: the count of IPv4 addresses on the camera port and the lifetime of each. No address.
hw_addresses() {
  hw_read_quiet 'addresses on the camera port' ip -4 addr show dev "${1:-<camera-interface>}"
  # shellcheck disable=SC2016
  hw_reduce '$1 == "inet" { c++ } $1 == "valid_lft" { life = life " " $2 } END { print (c + 0) "; valid_lft of each:" (life == "" ? " (none)" : life) }'
  obs 'addresses on the camera port' "$HW_RED"
}

# hw_marks: the count of mark files of the address helper (their names are addresses and are not printed).
hw_marks() {
  local marks=0 f
  if [ "$HW_DRY" = 1 ]; then
    hw_line '   would-count: the files under /run/dems-core-netalias/marks (names not printed)'
  elif [ -d "$HW_ROOT/run/dems-core-netalias/marks" ] && [ -r "$HW_ROOT/run/dems-core-netalias/marks" ]; then
    HW_READ_COUNT=$((HW_READ_COUNT + 1))
    for f in "$HW_ROOT/run/dems-core-netalias/marks"/*; do
      if [ -e "$f" ]; then marks=$((marks + 1)); fi
    done
    obs 'mark files of the helper' "$marks"
  else
    HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
    hw_line '   NOT COLLECTED: the marks folder is not readable by this account; the USER counts: sudo find /run/dems-core-netalias/marks -type f | wc -l'
  fi
}

# hw_clock_seconds <HH:MM:SS>: seconds of the day, in HW_RED.
hw_clock_seconds() {
  local h=${1%%:*} rest=${1#*:}
  local m=${rest%%:*} sec=${rest#*:}
  HW_RED=$((10#$h * 3600 + 10#$m * 60 + 10#$sec))
}

hw_done() {
  local masked=0
  hw_line ''
  if [ "$HW_DRY" = 1 ]; then
    hw_line "-- $HW_SCRIPT: DRY; readings taken 0; files written 0; programs started 0"
    return 0
  fi
  exec 3>&-
  HW_FILE_OPEN=0
  masked=$(awk '{ n += gsub(/\[masked-[a-z-]+\]/, "&") } END { print n + 0 }' "$HW_OUT_FILE" 2>/dev/null) || masked=unknown
  {
    printf '%s\n' "-- $HW_SCRIPT: collected; readings taken $HW_READ_COUNT; readings missing $HW_MISS_COUNT; credential-shaped values masked in this file: $masked (a count, never the value)"
    printf '%s\n' "-- evidence file name for the result line: $HW_OUT"
    printf '%s\n' '-- exit code 0 or 5 means "collected" or "collected with readings missing". It never means PASS.'
  } >>"$HW_OUT_FILE"
  printf '%s\n' "-- $HW_SCRIPT: collected; readings taken $HW_READ_COUNT; readings missing $HW_MISS_COUNT; credential-shaped values masked: $masked"
  printf '%s\n' "-- evidence file name for the result line: $HW_OUT"
  if [ "$HW_MISS_COUNT" -gt 0 ]; then exit 5; fi
  return 0
}
