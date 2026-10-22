#!/bin/bash
# DEMS Core host profile scripts: the shared part. SOURCED by the numbered scripts beside it,
# never run by itself.
#
# UNPROVEN ON LINUX. Written on a development Mac; only the print-only mode has ever run, and
# only there. The apply mode has run on no machine. What these scripts do on Ubuntu 24.04 is
# proven only by the hardware acceptance checks (9A/H-01 to 9A/H-27), line by line.
#
# Shell: bash, as Ubuntu 24.04 ships it (/bin/bash, 5.2). Not POSIX sh: the text substitution
# and the pattern tests below are bash. Kept to what bash 3.2 also has, so that the print-only
# mode runs on the development Mac.
#
# Rules every script here follows:
#   - print-only is the DEFAULT and changes nothing: it starts no program at all (shell
#     built-ins only), reads no file but this one, writes no file;
#   - a changing action runs only with --apply, only as root, only where /etc/os-release names
#     Ubuntu 24.04; no script calls sudo;
#   - no input is evaluated: /etc/os-release is read line by line and compared with fixed
#     words, every value given on the command line must match a closed pattern, and a value
#     is only ever passed as one argument of a fixed command;
#   - every step prints the item id (HOST-nn) of scripts/host/HOST-PROFILE-UBUNTU-24.04.md
#     that it implements, the check line that shows it took effect, and the hardware check
#     that settles a doubt ("to confirm in 9A/H-nn"). No script evaluates a check itself:
#     the checks are the installer's, in 9A/H-01.
#
# Exit codes: 0 done; 2 wrong usage or a refused value; 3 --apply refused (not Ubuntu 24.04,
# or not root).

# The placeholders of the profile document. Until a value is given they stay as written there.
HP_SERVICE_USER='<service-user>'
HP_INSTALL_DIR='<install-dir>'
HP_DATA_DIR='<data-dir>'
HP_FFMPEG_PREFIX='<ffmpeg-prefix>'
HP_CAMERA_INTERFACE='<camera-interface>'
# The Wi-Fi port whose camera-search answers are admitted too (HOST-23; decision D33 M-6, row 144).
HP_SEARCH_INTERFACE='<search-interface>'
HP_CAMERA_ADDRESS='<camera-address>'
# Fixed by the helper's delivery (scripts/host/netalias/dems-core-netalias.socket): not an option.
HP_HELPER_GROUP='dems-netalias'

HP_APPLY=0
HP_WITH_LID=0
HP_ITEM_COUNT=0
HP_RUN_COUNT=0
HP_WRITE_COUNT=0
HP_OUT=''

# Set by each script before hp_init: its name, its items, and whether it has any changing action.
HP_SCRIPT=${HP_SCRIPT:-host-profile}
HP_ITEMS=${HP_ITEMS:-}
HP_APPLY_SUPPORTED=${HP_APPLY_SUPPORTED:-0}

hp_fail() { # hp_fail <exit code> <message>
  printf '%s: %s\n' "$HP_SCRIPT" "$2" >&2
  exit "$1"
}

hp_usage() {
  printf '%s\n' "usage: $HP_SCRIPT [--print-only] [--apply] [values]"
  printf '%s\n' "  items: $HP_ITEMS"
  printf '%s\n' '  --print-only           the default: print every step, change nothing'
  if [ "$HP_APPLY_SUPPORTED" = 1 ]; then
    printf '%s\n' '  --apply                run the steps of class AUTO; root on Ubuntu 24.04 only'
  else
    printf '%s\n' '  --apply                refused: this script only prints'
  fi
  printf '%s\n' '  --service-user NAME    the account the Core runs as'
  printf '%s\n' '  --install-dir PATH     the root-owned product tree'
  printf '%s\n' '  --data-dir PATH        the data directory of the Core'
  printf '%s\n' '  --ffmpeg-prefix PATH   where the pinned FFmpeg is installed'
  printf '%s\n' '  --camera-interface IF  the network port that carries only the cameras'
  printf '%s\n' '  --camera-address A     the private address of the host on that port (no prefix)'
  printf '%s\n' '  --search-interface IF  the Wi-Fi port whose camera-search answers are admitted too (HOST-23)'
  printf '%s\n' '  --with-lid             the host has a lid (HOST-30)'
  printf '%s\n' 'UNPROVEN ON LINUX: proven only by the hardware checks 9A/H-01 to 9A/H-27.'
}

hp_check_user() {
  local re='^[a-z_][a-z0-9_-]{0,31}$'
  [[ $1 =~ $re ]] || hp_fail 2 'refused: --service-user must match [a-z_][a-z0-9_-]{0,31}'
  case "$1" in
    root | dems) hp_fail 2 'refused: --service-user must not be root or the account of an input-av installation' ;;
  esac
}

hp_check_path() { # hp_check_path <option> <value>
  local re='^/[A-Za-z0-9._/-]{1,200}$'
  [[ $2 =~ $re ]] || hp_fail 2 "refused: $1 must be an absolute path of letters, digits, dot, dash, underscore"
  case "$2" in
    */ | *//* | */./* | */. | */../* | */..) hp_fail 2 "refused: $1 must be a plain path (no //, no . or .. component, no trailing /)" ;;
  esac
}

hp_check_interface() {
  local re='^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$'
  [[ $1 =~ $re ]] || hp_fail 2 'refused: --camera-interface is not an interface name'
  if [ "$1" = lo ]; then hp_fail 2 'refused: --camera-interface must not be the loopback interface'; fi
}

hp_check_address() {
  local re='^(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})$'
  local a b c d private=0
  [[ $1 =~ $re ]] || hp_fail 2 'refused: --camera-address must be a dotted IPv4 address without a prefix'
  IFS=. read -r a b c d <<EOF
$1
EOF
  if [ "$a" -gt 255 ] || [ "$b" -gt 255 ] || [ "$c" -gt 255 ] || [ "$d" -gt 255 ]; then
    hp_fail 2 'refused: --camera-address is not an IPv4 address'
  fi
  if [ "$a" -eq 10 ]; then private=1; fi
  if [ "$a" -eq 172 ] && [ "$b" -ge 16 ] && [ "$b" -le 31 ]; then private=1; fi
  if [ "$a" -eq 192 ] && [ "$b" -eq 168 ]; then private=1; fi
  if [ "$private" -ne 1 ]; then hp_fail 2 'refused: --camera-address must be a private (RFC 1918) address'; fi
  if [ "$d" -lt 1 ] || [ "$d" -gt 254 ]; then hp_fail 2 'refused: --camera-address host part must be 1 to 254'; fi
}

# Ubuntu 24.04 and nothing else. The file is read as text; it is never sourced.
hp_os_is_expected() {
  local id='' ver='' line
  [ -r /etc/os-release ] || return 1
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ID=ubuntu | 'ID="ubuntu"') id=ubuntu ;;
      VERSION_ID=24.04 | 'VERSION_ID="24.04"') ver=24.04 ;;
    esac
  done </etc/os-release
  [ "$id" = ubuntu ] && [ "$ver" = 24.04 ]
}

hp_guard_apply() {
  if [ "$HP_APPLY_SUPPORTED" != 1 ]; then
    hp_fail 2 'refused: this script only prints; it has no changing action. Nothing was changed.'
  fi
  if ! hp_os_is_expected; then
    hp_fail 3 'refused: --apply runs on Ubuntu 24.04 only (/etc/os-release does not name it). Nothing was changed.'
  fi
  if [ "${EUID:-1}" -ne 0 ]; then
    hp_fail 3 'refused: --apply must be run by root (the scripts call no sudo). Nothing was changed.'
  fi
}

# hp_need <option name>...: with --apply, the named values must have been given.
hp_need() {
  local name value
  [ "$HP_APPLY" = 1 ] || return 0
  for name in "$@"; do
    case "$name" in
      service-user) value=$HP_SERVICE_USER ;;
      install-dir) value=$HP_INSTALL_DIR ;;
      data-dir) value=$HP_DATA_DIR ;;
      ffmpeg-prefix) value=$HP_FFMPEG_PREFIX ;;
      camera-interface) value=$HP_CAMERA_INTERFACE ;;
      search-interface) value=$HP_SEARCH_INTERFACE ;;
      camera-address) value=$HP_CAMERA_ADDRESS ;;
      *) hp_fail 2 "internal: unknown value name $name" ;;
    esac
    case "$value" in
      '<'*) hp_fail 2 "refused: --apply needs --$name. Nothing was changed." ;;
    esac
  done
}

hp_init() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --print-only) HP_APPLY=0 ;;
      --apply) HP_APPLY=1 ;;
      --with-lid) HP_WITH_LID=1 ;;
      -h | --help)
        hp_usage
        exit 0
        ;;
      --service-user | --install-dir | --data-dir | --ffmpeg-prefix | --camera-interface | --camera-address | --search-interface)
        if [ $# -lt 2 ]; then hp_fail 2 "refused: $1 needs a value"; fi
        case "$1" in
          --service-user)
            hp_check_user "$2"
            HP_SERVICE_USER=$2
            ;;
          --install-dir)
            hp_check_path "$1" "$2"
            HP_INSTALL_DIR=$2
            ;;
          --data-dir)
            hp_check_path "$1" "$2"
            HP_DATA_DIR=$2
            ;;
          --ffmpeg-prefix)
            hp_check_path "$1" "$2"
            HP_FFMPEG_PREFIX=$2
            ;;
          --camera-interface)
            hp_check_interface "$2"
            HP_CAMERA_INTERFACE=$2
            ;;
          --camera-address)
            hp_check_address "$2"
            HP_CAMERA_ADDRESS=$2
            ;;
          --search-interface)
            hp_check_interface "$2"
            HP_SEARCH_INTERFACE=$2
            ;;
        esac
        shift
        ;;
      *) hp_fail 2 'refused: unknown option (see --help). Nothing was changed.' ;;
    esac
    shift
  done
  if [ "$HP_APPLY" = 1 ]; then hp_guard_apply; fi
  printf '%s\n' "# $HP_SCRIPT ($HP_ITEMS)"
  if [ "$HP_APPLY" = 1 ]; then
    printf '%s\n' '# mode: APPLY. Steps of class AUTO are run; MANUAL and NONE steps are printed only.'
  else
    printf '%s\n' '# mode: PRINT-ONLY. Nothing is run, nothing is written.'
  fi
  printf '%s\n' '# UNPROVEN ON LINUX: no step below has run on Ubuntu 24.04; proven only by the hardware checks 9A/H-nn.'
}

# Replaces the placeholders of the profile document by the values given. Result in HP_OUT.
hp_subst() {
  HP_OUT=$1
  HP_OUT=${HP_OUT//<service-user>/$HP_SERVICE_USER}
  HP_OUT=${HP_OUT//<install-dir>/$HP_INSTALL_DIR}
  HP_OUT=${HP_OUT//<data-dir>/$HP_DATA_DIR}
  HP_OUT=${HP_OUT//<ffmpeg-prefix>/$HP_FFMPEG_PREFIX}
  HP_OUT=${HP_OUT//<camera-interface>/$HP_CAMERA_INTERFACE}
  HP_OUT=${HP_OUT//<camera-address>/$HP_CAMERA_ADDRESS}
  HP_OUT=${HP_OUT//<search-interface>/$HP_SEARCH_INTERFACE}
  HP_OUT=${HP_OUT//<helper-group>/$HP_HELPER_GROUP}
}

# Prints the lines of standard input, each behind a label, with the placeholders replaced.
hp_lines() { # hp_lines <label>
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    hp_subst "$line"
    printf '   %-8s: %s\n' "$1" "$HP_OUT"
  done
}

# item <id> <class> <title>
#   AUTO    the step has a command this script runs with --apply
#   MANUAL  the step is the user's own action; no mode of this script runs it
#   NONE    the step has no command; the reason follows
item() {
  HP_ITEM_COUNT=$((HP_ITEM_COUNT + 1))
  hp_subst "$3"
  printf '\n== %s  %s\n' "$1" "$HP_OUT"
  case "$2" in
    AUTO) printf '   %-8s: %s\n' class 'AUTO (run by this script only with --apply)' ;;
    MANUAL) printf '   %-8s: %s\n' class 'MANUAL (the user runs it; no mode of this script does)' ;;
    NONE) printf '   %-8s: %s\n' class 'NONE (no command)' ;;
    *) hp_fail 2 "internal: unknown class $2" ;;
  esac
}

manual() { hp_lines manual; }
why() { hp_lines why; }
note() { hp_lines note; }
check() { hp_lines check; }

confirm() { # confirm - | confirm <text after "to confirm in ">
  if [ "$1" = - ]; then
    printf '   %-8s: %s\n' confirm '- (no specific doubt; still unverified on Ubuntu)'
  else
    hp_subst "$1"
    printf '   %-8s: to confirm in %s\n' confirm "$HP_OUT"
  fi
}

# act <program> <argument>...: the ONLY place a changing program is started.
act() {
  if [ "$HP_APPLY" = 1 ]; then
    printf '   %-8s: %s\n' run "$*"
    HP_RUN_COUNT=$((HP_RUN_COUNT + 1))
    "$@"
  else
    printf '   %-8s: %s\n' would-run "$*"
  fi
}

# put_file <path> <mode> <owner> <group>: content on standard input, placeholders replaced.
# The ONLY place a file is written, and only with --apply.
put_file() {
  local line tmp
  if [ "$HP_APPLY" = 1 ]; then
    printf '   %-8s: %s (owner %s, group %s, mode %s)\n' write "$1" "$3" "$4" "$2"
    tmp=$(mktemp)
    while IFS= read -r line || [ -n "$line" ]; do
      hp_subst "$line"
      printf '%s\n' "$HP_OUT"
    done >"$tmp"
    HP_WRITE_COUNT=$((HP_WRITE_COUNT + 1))
    install -m "$2" -o "$3" -g "$4" "$tmp" "$1"
    rm -f "$tmp"
  else
    printf '   %-8s: %s (owner %s, group %s, mode %s)\n' would-write "$1" "$3" "$4" "$2"
    while IFS= read -r line || [ -n "$line" ]; do
      hp_subst "$line"
      printf '   %-8s| %s\n' '' "$HP_OUT"
    done
  fi
}

# show_file <path>: a file the user writes; printed in every mode, never written by a script.
show_file() {
  local line
  printf '   %-8s: %s\n' file "$1 (written by the user; no mode of this script writes it)"
  while IFS= read -r line || [ -n "$line" ]; do
    hp_subst "$line"
    printf '   %-8s| %s\n' '' "$HP_OUT"
  done
}

hp_done() {
  local mode=print-only
  if [ "$HP_APPLY" = 1 ]; then mode=apply; fi
  printf '\n-- %s: mode %s; items %s; commands run %s; files written %s\n' \
    "$HP_SCRIPT" "$mode" "$HP_ITEM_COUNT" "$HP_RUN_COUNT" "$HP_WRITE_COUNT"
}
