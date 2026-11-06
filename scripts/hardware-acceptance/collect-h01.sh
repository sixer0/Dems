#!/bin/bash
# Hardware acceptance, check 9A/H-01 (chapter 2): the host profile applied; the capture programs
# built and checked; the listener's path gate on this host's build.
#
#   --profile  --service-user U --install-dir D --data-dir D --ffmpeg-prefix P --camera-interface IF
#              [--sudo-reads FILE]                                                       step .2
#   --announce --ffmpeg-prefix P [--port N] [--codec mpeg4|libx264|libopenh264]
#              [--pusher /abs/path/ffmpeg] [--probe-source FILE]                         step .10
#   --series   --series-output FILE [--series-dir DIR]                                   step .11
#
# --profile reads; it applies nothing (applying is step .1, the USER's, with scripts/host/).
# Per item HOST-01 to HOST-42 it prints the item's check command, its output and ONE WORD: "met"
# or "not met" where the profile states an exact text to compare, "to judge" where a person must
# read (and for every reading that needs sudo: those are handed over), "deferred" with the check
# that reads it. The words are readings for the USER; they are not a result of the check.
#
# --announce is the ONE mode of the package that starts programs which are not readers: a
# compiler (the probe of experiment E-11b, e11b-announce-probe/probe.c beside this script), the
# probe (a listener on 127.0.0.1 for at most 12 s per run, six runs) and a pusher to it (the
# pinned ffmpeg with a generated test picture). It changes nothing on the host: no service, no
# interface, no rule, no file outside the evidence folder (its work folder lies there and is
# removed at the end). It sends no signal. It is the repeat of gate BR-10 on this host's build.
#
# --series reads the saved output of step .9 (make -C apps/capture-worker e2e > FILE).
#
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h01.sh
HW_CHECK='9A/H-01'
HW_CHAPTER=2
HW_MODES='profile announce series'
HW_ACCEPTS='service-user install-dir data-dir ffmpeg-prefix camera-interface sudo-reads port codec pusher probe-source series-output series-dir'
HW_SUMMARY='the profile items HOST-01 to HOST-42 with their check output; the announce line of this host'"'"'s media library; the permanent cases of the worker'"'"'s series'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"

criterion '1. profile items "not met": 0 (deferred items are not counted here); 2. the loopback rule: counter rise of at least 1 for the foreign account, 0 for the service user; rule present after the restart: 1 of 1; 3. the three programs built: 3 of 3, each stating libavformat 63.1.102; the worker'"'"'s make exits 0; 4. the announce line: present with the stated text, level 56 and instant in 6 of 6 runs; 5. the permanent cases: near misses refused 7 of 7 with controls recording 7 of 7; the no-line case refused 1 of 1; path texts in the worker'"'"'s log and output: 0.'

# ---------------------------------------------------------------------------------------------
# --profile
# ---------------------------------------------------------------------------------------------
ITEM=''
STATE=''
WHY=''
N_MET=0
N_NOT=0
N_JUDGE=0
N_DEFERRED=0

close_item() {
  [ -n "$ITEM" ] || return 0
  if [ "$HW_DRY" = 1 ]; then
    hw_line "   would-state: $ITEM met, not met, to judge or deferred"
    ITEM=''
    return 0
  fi
  case "${STATE:-to judge}" in
    met) N_MET=$((N_MET + 1)) ;;
    'not met') N_NOT=$((N_NOT + 1)) ;;
    deferred) N_DEFERRED=$((N_DEFERRED + 1)) ;;
    *)
      STATE='to judge'
      N_JUDGE=$((N_JUDGE + 1))
      ;;
  esac
  hw_line "   reading : $ITEM $STATE${WHY:+ ($WHY)}"
  ITEM=''
}
item() { # item <id> <title>
  close_item
  ITEM=$1
  STATE=''
  WHY=''
  hw_line ''
  hw_line "== $1  $2"
}
# The word of an item only ever gets worse: met < to judge < not met. "deferred" is set alone.
mark() { # mark <met|not met|to judge|deferred> <why>
  case "$STATE:$1" in
    'not met:'*) return 0 ;;
    'to judge:met') return 0 ;;
  esac
  STATE=$1
  WHY=$2
}
holds() { # holds <text>: the last reading must hold this text
  if [ "$HW_DRY" = 1 ]; then
    hw_line "   would-compare: the output holds \"$1\""
    return 0
  fi
  if [ "$HW_CODE" = 127 ]; then
    mark 'to judge' 'a tool is missing'
    return 0
  fi
  case "$HW_TEXT" in
    *"$1"*) mark met "the output holds \"$1\"" ;;
    *) mark 'not met' "the output does not hold \"$1\"" ;;
  esac
}
reduced_is() { # reduced_is <expected> <what was counted>
  if [ "$HW_DRY" = 1 ]; then
    hw_line "   would-compare: $2 = $1"
    return 0
  fi
  if [ "$HW_CODE" = 127 ]; then
    mark 'to judge' 'a tool is missing'
    return 0
  fi
  obs "$2" "$HW_RED"
  if [ "$HW_RED" = "$1" ]; then mark met "$2 = $1"; else mark 'not met' "$2 is not $1"; fi
}
judge() { if [ "$HW_DRY" = 1 ]; then hw_line "   would-leave to the USER: $1"; else mark 'to judge' "$1"; fi; }
defer() { if [ "$HW_DRY" = 1 ]; then hw_line "   deferred: read in $1"; else mark deferred "read in $1"; fi; }
by_user() { user_step "$1"; judge 'the reading needs sudo: the USER takes it and holds it against the profile'; }

# namei -l of a path: components, and how many are not root-owned or are writable by group or others.
# shellcheck disable=SC2016
NAMEI_REDUCE='$1 ~ /^[dl-]/ { c++; if ($2 != "root") bad++; else if (substr($1, 6, 1) == "w" || substr($1, 9, 1) == "w") bad++ } END { print (c ? bad + 0 : "no component listed") }'

profile() {
  local u=${HW_SERVICE_USER:-<service-user>} inst=${HW_INSTALL_DIR:-<install-dir>} data=${HW_DATA_DIR:-<data-dir>}
  local prefix=${HW_FFMPEG_PREFIX:-<ffmpeg-prefix>} cam=${HW_CAMERA_INTERFACE:-<camera-interface>} node_path crash f
  step '9A/H-01.2' SCRIPT 'for every item HOST-01 to HOST-42 the item'"'"'s check command and its output, and one word per item, met or not met; checks that need sudo are run by USER and their output is given to the collector as a file; items whose check needs a running Core are printed as deferred with the check that reads them'
  expected 'every item that is not deferred reads met.'
  if [ "$HW_DRY" != 1 ]; then
    if [ -z "$HW_SERVICE_USER" ] || [ -z "$HW_INSTALL_DIR" ] || [ -z "$HW_DATA_DIR" ] || [ -z "$HW_FFMPEG_PREFIX" ] || [ -z "$HW_CAMERA_INTERFACE" ]; then
      hw_fail 2 'refused: --profile needs --service-user, --install-dir, --data-dir, --ffmpeg-prefix and --camera-interface. Nothing more was read.'
    fi
  fi

  item HOST-01 'The host runs Ubuntu 24.04 LTS'
  hw_read 'release line' lsb_release -ds
  holds 'Ubuntu 24.04'
  hw_read 'processor architecture (recorded in the header of the result record)' uname -m

  item HOST-02 'No input-av installation is on the host'
  hw_read 'units of input-av' systemctl list-unit-files 'dems-nvr*' 'dems-mediamtx*'
  holds '0 unit files listed'
  by_user 'sudo ls /usr/local/sbin/dems-netalias /etc/sudoers.d/dems-netalias     (No such file or directory, twice; check 9A/H-27 reads the rest)'

  item HOST-03 'The host has no interactive account besides its one administrator'
  hw_fixed_file 'accounts (names are not printed; a count of login shells)' /etc/passwd
  # shellcheck disable=SC2016
  hw_reduce '$7 !~ /nologin$/ && $7 !~ /false$/ { c++; if ($1 == "root" || $1 == "sync") known++ } END { print (c + 0) " accounts with a login shell, of them root or sync: " (known + 0) }' -F:
  obs 'accounts' "$HW_RED"
  judge 'expected: root, sync and the one administrator account, nothing else (3 accounts)'

  item HOST-04 'A system account for the Core, without a login shell'
  hw_read_quiet 'the service account' getent passwd "$u"
  # shellcheck disable=SC2016
  hw_reduce '{ n++; if ($7 == "/usr/sbin/nologin") ok++ } END { print (n == 1 && ok == 1) ? "1" : "0" }' -F:
  reduced_is 1 'lines of the service account that end with /usr/sbin/nologin'

  item HOST-05 'The product tree belongs to root and is not writable by the service user'
  hw_read 'every component of the worker'"'"'s path' namei -l "$inst/apps/capture-worker/build/capture-worker"
  hw_reduce "$NAMEI_REDUCE"
  reduced_is 0 'components not owned by root or writable by group or others'

  item HOST-06 'The data directory and the media store belong to the service user and are owner-only'
  by_user "sudo stat -c '%U %G %a' <data-dir> <data-dir>/media/sessions     (<service-user> <service-user> 700, twice)"

  item HOST-07 'The evidence volume supports hard links, exclusive file creation and a durable sync'
  hw_read 'file system of the media store (a folder this account may not enter gives no line: then by the USER with sudo)' findmnt -no FSTYPE,SOURCE --target "$data/media/sessions"
  judge 'a local Linux file system, not a network share, not FAT or exFAT; the sync level is read in 9A/H-03'

  item HOST-08 'The run directory is mode 0700 and every microphone pipe in it is mode 0600'
  defer '9A/H-17 (collect-h17.sh --live, during a running session)'

  item HOST-09 'Node.js 26.8.2 under a root-owned path'
  hw_read 'version' node --version
  holds 'v26.8.2'
  if [ "$HW_DRY" = 1 ]; then
    node_path='<path of node>'
  else
    node_path=$(command -v node 2>/dev/null) || node_path=/usr/bin/node
  fi
  hw_read 'every component of its path' namei -l "$node_path"
  hw_reduce "$NAMEI_REDUCE"
  reduced_is 0 'components of the path of node not owned by root or writable by group or others'

  item HOST-10 'Build tools'
  hw_read_quiet 'packages' dpkg -s clang make pkg-config python3 nasm libasound2-dev
  # shellcheck disable=SC2016
  hw_reduce '/^Status: install ok installed/ { c++ } END { print c + 0 }'
  reduced_is 6 'packages with "Status: install ok installed"'

  item HOST-11 'The distribution'"'"'s FFmpeg development packages are absent'
  hw_read 'the package libavformat-dev' dpkg -s libavformat-dev
  holds 'is not installed'

  item HOST-12 'FFmpeg 9.0.2 (libavformat 63.1.102) with the ALSA input, as shared libraries'
  hw_read 'version of the pinned program' "$prefix/bin/ffmpeg" -hide_banner -version
  holds '9.0.2'
  # shellcheck disable=SC2016
  hw_reduce '$1 == "libavformat" { v = $0; gsub(/ /, "", v); if (index(v, "libavformat63.1.102") == 1) ok = 1 } END { print ok + 0 }'
  reduced_is 1 'lines "libavformat 63.  1.102"'
  hw_read_quiet 'devices of the pinned program' "$prefix/bin/ffmpeg" -hide_banner -devices
  # shellcheck disable=SC2016
  hw_reduce '$2 == "alsa" && $1 ~ /D/ { c++ } END { print c + 0 }'
  reduced_is 1 'device lines "alsa" with the demuxing mark D'

  item HOST-13 'The dynamic loader finds the pinned libraries'
  hw_read_quiet 'loader cache' ldconfig -p
  # shellcheck disable=SC2016
  hw_reduce 'index($0, "libavformat.so.63") > 0 { n++; if (index($0, p "/lib/") > 0) under++ } END { print (n > 0 && n == under) ? "1" : "0" }' -v p="$prefix"
  reduced_is 1 'libavformat.so.63 listed, and only under <ffmpeg-prefix>/lib'

  item HOST-14 'The capture worker built against the pinned library'
  hw_read_quiet 'libraries the worker resolves' ldd "$inst/apps/capture-worker/build/capture-worker"
  # shellcheck disable=SC2016
  hw_reduce 'index($0, "libavformat.so.63") > 0 { n++; if (index($0, p "/lib/") > 0) under++ } END { print (n == 1 && under == 1) ? "1" : "0" }' -v p="$prefix"
  reduced_is 1 'libavformat.so.63 resolved under <ffmpeg-prefix>/lib'
  note 'that the build itself exits 0 is step 9A/H-01.6, the USER'"'"'s'

  item HOST-15 'The camera relay and the guard program built against the same library'
  judge 'step 9A/H-01.7, the USER'"'"'s: both build commands exit 0 and each program states libavformat 63.1.102'

  item HOST-16 'The microphone helper is the pinned FFmpeg program, reached by an absolute root-owned path'
  hw_read 'every component of its path' namei -l "$prefix/bin/ffmpeg"
  hw_reduce "$NAMEI_REDUCE"
  reduced_is 0 'components not owned by root or writable by group or others'

  item HOST-17 'The process listing gives the full program path to the leftover check'
  hw_read_quiet 'short names' ps -axo pid=,comm=
  # shellcheck disable=SC2016
  hw_reduce '{ n = length($2); if (n > max) max = n } END { print max + 0 }'
  obs 'longest short name, in characters (at most 15 expected)' "$HW_RED"
  judge 'an observation; check 9A/H-24 (collect-h24.sh --tools) records both forms'

  item HOST-18 'The conflict-check tool is the iputils one'
  hw_read 'owner package of /usr/bin/arping' dpkg -S /usr/bin/arping
  holds 'iputils-arping: /usr/bin/arping'
  hw_read 'the other package named arping' dpkg -s arping
  holds 'is not installed'

  item HOST-19 'The cameras are on a dedicated port: one static private /24 address, not the default route'
  hw_read_quiet 'addresses on the camera port' ip -br -4 addr show dev "$cam"
  # shellcheck disable=SC2016
  hw_reduce '{ for (k = 3; k <= NF; k++) if ($k ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\//) c++ } END { print c + 0 }'
  reduced_is 1 'addresses on the camera port'
  hw_read_quiet 'default route' ip -4 route show default
  # shellcheck disable=SC2016
  hw_reduce '{ for (k = 1; k < NF; k++) if ($k == "dev" && $(k + 1) == i) c++ } END { print c + 0 }' -v i="$cam"
  reduced_is 0 'default routes through the camera port'

  item HOST-20 'Forwarding between the camera port and any other port is off'
  hw_read 'forwarding switches' sysctl -n net.ipv4.ip_forward net.ipv6.conf.all.forwarding
  # shellcheck disable=SC2016
  hw_reduce '{ n++; if ($1 == "0") z++ } END { print (n == 2 && z == 2) ? "1" : "0" }'
  reduced_is 1 'both switches print 0'
  hw_fixed_file 'forwarding on the camera port' "/proc/sys/net/ipv4/conf/$cam/forwarding"
  # shellcheck disable=SC2016
  hw_reduce 'NR == 1 { print ($1 == "0") ? "1" : "0" }'
  reduced_is 1 'the camera port prints 0'

  item HOST-21 'Nothing on the host turns forwarding back on'
  hw_read_quiet 'packages of a container runtime, a bridge or a VPN' dpkg -l 'docker*' 'containerd*' 'libvirt*' 'wireguard*'
  # shellcheck disable=SC2016
  hw_reduce '$1 == "ii" { c++ } END { print c + 0 }'
  reduced_is 0 'installed packages of that kind'

  item HOST-22 'The firewall is on and denies incoming and routed traffic by default'
  by_user 'sudo ufw status verbose     (Status: active; Default: deny (incoming), allow (outgoing), deny (routed))'

  item HOST-23 'Answers to the camera search are admitted on the camera port'
  by_user 'sudo ufw status numbered     (one rule with: on <camera-interface>, udp, source port 3702). Second half deferred: the search lists a camera, read in 9A/H-12'

  item HOST-24 'The Core'"'"'s own services are not reachable on the camera port'
  by_user 'sudo ss -H -ltnp ; sudo ufw status     (every listener of <service-user> on 127.0.0.1; no ALLOW line for ports 4420 to 4423). With a running Core it is read again in 9A/H-16'

  item HOST-25 'Loopback rule: only <service-user> can open 127.0.0.1 ports 8554 to 8564'
  hw_read 'the unit of the rule' systemctl is-active dems-loopback-rule.service
  holds 'active'
  by_user 'sudo nft list table inet dems_loopback     (one rule: tcp dport 8554-8564, skuid != <service-user>; the counter readings are step 9A/H-01.3)'

  item HOST-26 'ALSA tools present; the service user may open the sound devices'
  hw_read_quiet 'groups of the service user' id -nG "$u"
  # shellcheck disable=SC2016
  hw_reduce '{ for (i = 1; i <= NF; i++) if ($i == "audio") a = 1 } END { print a + 0 }'
  reduced_is 1 'the groups of the service user hold audio'
  note 'the card listing as the service user is read in 9A/H-07'

  item HOST-27 'The audio interface is USB Audio Class'
  judge 'read in 9A/H-07 (collect-h07.sh --host) once the interface is connected'

  item HOST-28 'No sound server holds the interface'
  by_user 'with no session running: sudo fuser -v /dev/snd/pcmC*D*c     (prints no process; step 9A/H-08.1)'

  item HOST-29 'The host never sleeps or hibernates'
  hw_read 'the four sleep targets' systemctl is-enabled sleep.target suspend.target hibernate.target hybrid-sleep.target
  # shellcheck disable=SC2016
  hw_reduce '$1 == "masked" { c++ } END { print c + 0 }'
  reduced_is 4 'targets that print masked'

  item HOST-30 'On a host with a lid: closing it does nothing'
  judge 'only if the host has a lid: systemd-analyze cat-config systemd/logind.conf shows the three HandleLidSwitch lines'

  item HOST-31 'The host'"'"'s clock is synchronised'
  hw_read 'synchronised' timedatectl show -p NTPSynchronized --value
  holds 'yes'
  note 'step 9A/H-01.5: with the room network unplugged the value is recorded as read; "no" there does not fail the check (open point 5 of chapter 1)'

  item HOST-32 'The Core starts only after the clock is synchronised'
  hw_read 'the wait service' systemctl is-enabled systemd-time-wait-sync.service
  holds 'enabled'
  hw_read 'order of the Core'"'"'s unit' systemctl show dems-core.service -p After
  holds 'time-sync.target'

  item HOST-33 'The unit file, owned by root'
  hw_read 'owner and mode' stat -c '%U %G %a' /etc/systemd/system/dems-core.service
  holds 'root root 644'
  by_user 'sudo systemd-analyze verify /etc/systemd/system/dems-core.service     (prints no error; the ExecStart line is settled in 9A/H-16)'

  item HOST-34 'The environment file: owner root, group of the service user, no development switch'
  by_user "sudo stat -c '%U %G %a' /etc/dems/core.env ; sudo grep -c -E '^(DEMS_CAPTURE_DEV_SOURCES|DEMS_DEMO_CONTROLS|NODE_OPTIONS)=' /etc/dems/core.env     (root <service-user> 640; the count 0). The file is never opened by a collector and no value of it is printed"

  item HOST-35 'Core-file limit of the Core is 0'
  hw_read 'the unit'"'"'s limit' systemctl show dems-core.service -p LimitCORE
  holds 'LimitCORE=0'
  note 'the process half (/proc/<core-pid>/limits) is deferred to 9A/H-16'

  item HOST-36 'The Core is started without a diagnostic-report, heap-snapshot or debugger switch'
  defer '9A/H-16 (collect-h16.sh --process: counts, never the environment)'

  item HOST-37 'The system'"'"'s crash collector does not take a memory image of the Core'
  hw_read 'the crash collector' systemctl is-enabled apport.service
  if [ "$HW_DRY" = 1 ]; then
    hw_line '   would-compare: the output is disabled or masked'
  else
    case "$HW_TEXT" in disabled | masked) mark met 'apport.service is disabled or masked' ;; *) mark 'not met' 'apport.service is neither disabled nor masked' ;; esac
  fi
  hw_read 'core pattern (to hold against file C of the profile) and the dump switch' sysctl -n kernel.core_pattern fs.suid_dumpable
  # shellcheck disable=SC2016
  hw_reduce 'NR == 2 { print ($1 == "0") ? "1" : "0" }'
  reduced_is 1 'fs.suid_dumpable prints 0'
  if [ "$HW_DRY" = 1 ]; then
    hw_line '   would-count: the entries of /var/crash'
  else
    crash=0
    for f in "$HW_ROOT/var/crash"/*; do
      if [ -e "$f" ]; then crash=$((crash + 1)); fi
    done
    obs 'entries of /var/crash' "$crash"
    if [ "$crash" != 0 ]; then mark 'not met' '/var/crash is not empty'; fi
  fi
  judge 'the core pattern printed above equals the value of file C: held by the USER'

  item HOST-38 'The Core cannot gain privileges'
  hw_read 'the unit'"'"'s setting' systemctl show dems-core.service -p NoNewPrivileges
  holds 'NoNewPrivileges=yes'
  note 'the process half (NoNewPrivs in /proc/<core-pid>/status) is deferred to 9A/H-16'

  item HOST-39 'The Core has an empty capability bounding set and no ambient capability'
  defer '9A/H-16 (collect-h16.sh --process) and 9A/H-17 (collect-h17.sh --live)'

  item HOST-40 'The Core runs with the audio group and the helper'"'"'s group, and no other'
  defer '9A/H-16 (collect-h16.sh --process); the helper'"'"'s group exists only after chapter 4 (open point E of chapter 2)'

  item HOST-41 'The Core starts only with the loopback rule in place'
  hw_read 'what the unit requires' systemctl show dems-core.service -p Requires
  holds 'dems-loopback-rule.service'
  note 'the stop half is deferred to 9A/H-16 step .8 and 9A/H-04'

  item HOST-42 'Files the Core creates are owner-only by default'
  defer '9A/H-16 (collect-h16.sh --process: Umask in /proc/<core-pid>/status)'
  close_item

  hw_line ''
  hw_handed 'the readings of the profile that need sudo' "$HW_SUDO_READS" 'run each "sudo ..." line printed above, save command and output into one file, pass it with --sudo-reads'
  if [ "$HW_DRY" != 1 ]; then
    hw_line ''
    obs 'items met' "$N_MET"
    obs 'items not met' "$N_NOT"
    obs 'items to judge by the USER (a sudo reading, or a reading a person must make)' "$N_JUDGE"
    obs 'items deferred' "$N_DEFERRED"
    obs 'items in all (HOST-01 to HOST-42)' "$((N_MET + N_NOT + N_JUDGE + N_DEFERRED))"
    note 'criterion 1 counts "not met" after the USER has turned every "to judge" into met or not met. This collector does not do that.'
  fi
}

# ---------------------------------------------------------------------------------------------
# --announce
# ---------------------------------------------------------------------------------------------
# The synthetic paths of experiment E-11b: of this package only, no device's, 16 characters (below
# the 22 of the ingest-secret form). They are never printed: <right> and <wrong> stand for them.
RIGHT_PATH='e11b/Hs3kP9wQ2nVb7Xc5'
WRONG_PATH='e11b/Hs3kP9wQ2nVb7Xc2'
WRONG_NEEDLE='Hs3kP9wQ2nVb7Xc2'

# starts <label> <program> <argument>...: prints what is started, masked, then starts it. Used by
# --announce only; the closed list is: mkdir and rm on the work folder. (pkg-config, cc, the probe, the pusher and
# sleep are started in announce() itself, each printed before it runs.)
starts() {
  local label=$1
  shift
  printf '%s\n' "$*" | hw_block "starts ($label)"
  case "$1" in
    mkdir | rm) ;;
    *) hw_fail 2 "internal: --announce refused to start $1" ;;
  esac
  "$@"
}

announce() {
  local prefix=${HW_FFMPEG_PREFIX:-<ffmpeg-prefix>} port=${HW_PORT:-18563} codec=${HW_CODEC:-mpeg4}
  local source=${HW_PROBE_SOURCE:-$HW_DIR/e11b-announce-probe/probe.c} pusher work flags run kind path sent tries code pid n
  pusher=${HW_PUSHER:-$prefix/bin/ffmpeg}
  step '9A/H-01.10' SCRIPT 'it builds the announce-line probe against <ffmpeg-prefix> and runs it in observe mode against a pusher: 3 runs to the listener'"'"'s own path, 3 runs to the last-character near miss. Per run: the library version line; every line of the form Parsing[<n>]: ANNOUNCE <address> RTSP/1.0 with its level and its instant relative to the return of the open; every line that starts "Updating control URI to"; the statuses the pusher read; the packets the probe read. Paths are printed as <right> and <wrong>, never as text.'
  expected 'in 6 of 6 runs exactly one line Parsing[<n>]: ANNOUNCE <address> RTSP/1.0, at level 56, inside the open and before the answer to ANNOUNCE is sent, with <address> equal to what the pusher sent and <n> equal to the length of that request line. In the 3 wrong-path runs also one line "Updating control URI to <address>"; in the 3 right-path runs none. In all 6 runs the pusher read status 200 four times and the probe read 25 packets.'
  note 'THIS MODE STARTS PROGRAMS: a compiler, the probe (a listener on 127.0.0.1 only, at most 12 s per run) and a pusher to it. No service, interface, rule or file outside the evidence folder is touched; no signal is sent.'
  note "port $port on the loopback interface (never 8554 to 8564: the loopback rule of HOST-25 guards those against this account). Pusher codec: $codec."
  note 'DRIVER DECISION of the scripts row: the default pusher is the pinned ffmpeg with its built-in mpeg4 encoder and a generated test picture, because the configure line of HOST-12 builds no H.264 or H.265 encoder (open point B of chapter 2). The announce line is read during ANNOUNCE, before any media; --codec libx264 with --pusher names another ffmpeg if the site has one.'
  note 'what the probe cannot show: the worker compares the WHOLE message, its ending newline included (apps/capture-worker/src/announce.c); the probe strips line ends. The whole-message proof on this host is the worker'"'"'s own series (steps .9 and .11).'
  if [ "$HW_DRY" = 1 ]; then
    hw_line "   would-start: mkdir <evidence-folder>/h01-run$HW_RUN-announce.work"
    hw_line "   would-start: PKG_CONFIG_PATH=$prefix/lib/pkgconfig pkg-config --cflags --libs libavformat libavcodec libavutil"
    hw_line "   would-start: cc -std=c11 -O2 -o <work>/probe $source <the flags pkg-config printed> -lm -lpthread"
    hw_line "   would-start, six times: LD_LIBRARY_PATH=$prefix/lib <work>/probe $port <right> observe 12 <needle>     (output into the work folder)"
    hw_line "   would-read, per run: ss -H -ltn until the probe listens (at most 5 s)"
    hw_line "   would-start, six times: $pusher -hide_banner -nostdin -loglevel trace -re -f lavfi -i testsrc2=size=320x240:rate=25 -frames:v 100 -an -pix_fmt yuv420p -g 25 -bf 0 -c:v $codec -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:$port/<right or wrong>"
    hw_line '   would-start: rm -rf <evidence-folder>/h01-run<k>-announce.work'
    return 0
  fi
  [ -n "$HW_FFMPEG_PREFIX" ] || hw_fail 2 'refused: --announce needs --ffmpeg-prefix. Nothing was started.'
  [ -r "$source" ] || hw_fail 2 'refused: the probe source is not readable (e11b-announce-probe/probe.c beside this script, or --probe-source). Nothing was started.'
  [ -x "$pusher" ] || hw_fail 2 'refused: the pusher is not an executable file (default <ffmpeg-prefix>/bin/ffmpeg, or --pusher). Nothing was started.'
  work="$HW_EVIDENCE/h01-run$HW_RUN-announce.work"
  [ ! -e "$work" ] || hw_fail 2 'refused: the work folder of this run exists in the evidence folder. Nothing was started.'
  starts 'work folder inside the evidence folder' mkdir "$work"

  hw_line '   starts (compiler flags of the pinned library) | PKG_CONFIG_PATH=<ffmpeg-prefix>/lib/pkgconfig pkg-config --cflags --libs libavformat libavcodec libavutil'
  flags=$(PKG_CONFIG_PATH="$prefix/lib/pkgconfig" pkg-config --cflags --libs libavformat libavcodec libavutil 2>/dev/null) || flags=''
  code=0
  set -f
  # shellcheck disable=SC2086
  printf '%s\n' "cc -std=c11 -O2 -o $work/probe $source $flags -lm -lpthread" | hw_block 'starts (the probe, built from the source carried in the package)'
  # shellcheck disable=SC2086
  cc -std=c11 -O2 -o "$work/probe" "$source" $flags -lm -lpthread >"$work/build.out" 2>&1 || code=$?
  set +f
  obs 'the probe built (exit code of the compiler)' "$code"
  if [ "$code" != 0 ] || [ ! -x "$work/probe" ]; then
    HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
    hw_line '   NOT COLLECTED: the probe did not build; the lines of the compiler follow'
    hw_block '   build   ' <"$work/build.out"
    starts 'work folder removed' rm -rf "$work"
    return 0
  fi

  n=0
  for run in right:1 right:2 right:3 wrong:1 wrong:2 wrong:3; do
    kind=${run%%:*}
    n=$((n + 1))
    if [ "$kind" = right ]; then path=$RIGHT_PATH; else path=$WRONG_PATH; fi
    sent="rtsp://127.0.0.1:$port/$path"
    hw_line ''
    hw_line "   -- run $n of 6: the pusher announces <$kind>"
    LD_LIBRARY_PATH="$prefix/lib" "$work/probe" "$port" "$RIGHT_PATH" observe 12 "$WRONG_NEEDLE" >"$work/$n.probe" 2>&1 &
    pid=$!
    tries=0
    while [ "$tries" -lt 25 ]; do
      if ss -H -ltn 2>/dev/null | awk -v p=":$port" '{ if (substr($4, length($4) - length(p) + 1) == p) found = 1 } END { exit found ? 0 : 1 }'; then break; fi
      tries=$((tries + 1))
      sleep 0.2
    done
    if [ "$tries" -ge 25 ]; then hw_line '      the probe was not seen listening within 5 s; the push is tried all the same'; fi
    code=0
    "$pusher" -hide_banner -nostdin -loglevel trace -re -f lavfi -i testsrc2=size=320x240:rate=25 -frames:v 100 -an -pix_fmt yuv420p \
      -g 25 -bf 0 -c:v "$codec" -f rtsp -rtsp_transport tcp "$sent" >"$work/$n.push" 2>&1 || code=$?
    wait "$pid" || :
    HW_READ_COUNT=$((HW_READ_COUNT + 1))
    # shellcheck disable=SC2016
    awk -v sent="$sent" -v kind="$kind" '
      function instant(line,   t) { t = line; sub(/^[A-Z_]+ +t= */, "", t); sub(/ms.*/, "", t); return t + 0 }
      /^PROBE / { for (i = 1; i < NF; i++) if (index($i, "libavformat=") == 1) version = $i " " $(i + 1) }
      /^LOG / {
        text = $0; sub(/^.*text=/, "", text)
        if (text ~ /^Parsing\[[0-9]+\]: ANNOUNCE /) {
          lines++
          n = text; sub(/^Parsing\[/, "", n); sub(/\].*/, "", n)
          request = text; sub(/^Parsing\[[0-9]+\]: /, "", request)
          if (length(request) == n + 0) length_ok++
          if (request == "ANNOUNCE " sent " RTSP/1.0") wording_ok++
          level = $0; sub(/^.*level= */, "", level); sub(/ .*/, "", level); levels = levels " " level
          if (index($0, "phase=avformat_open_input") > 0) inside++
          announce_at = instant($0)
        }
        if (index(text, "Updating control URI to") == 1) updates++
        if (index(text, "Sending response:") == 1 && index(text, "CSeq: 2") > 0 && answer_at == "") answer_at = instant($0)
      }
      /^OPEN / { open_at = instant($0); opened = (index($0, "avformat_open_input=0 ") > 0) ? "ok" : "failed" }
      /^RESULT / { for (i = 1; i <= NF; i++) if (index($i, "packets=") == 1) packets = substr($i, 9) }
      END {
        print "library version line: " (version == "" ? "(none printed)" : version)
        print "lines Parsing[<n>]: ANNOUNCE <address> RTSP/1.0: " lines + 0 "; level of each:" (levels == "" ? " -" : levels)
        print "of them with <n> equal to the length of the request line: " length_ok + 0
        print "of them with the request line equal to ANNOUNCE <" kind "> RTSP/1.0 as the pusher sent it: " wording_ok + 0
        print "of them inside avformat_open_input: " inside + 0
        print "instant of the line " (lines ? announce_at : "-") " ms; answer to ANNOUNCE sent at " (answer_at == "" ? "-" : answer_at) " ms; open returned at " (open_at == "" ? "-" : open_at) " ms (" (opened == "" ? "no OPEN line" : opened) ")"
        print "the line came before the answer to ANNOUNCE: " ((lines && answer_at != "" && announce_at <= answer_at) ? "yes" : "no or not determined")
        print "lines \"Updating control URI to\": " updates + 0
        print "packets the probe read: " (packets == "" ? "(no RESULT line)" : packets)
      }' "$work/$n.probe" | while IFS= read -r line; do hw_line "      probe   | $line"; done
    # shellcheck disable=SC2016
    awk '
      { s = $0; while (match(s, /line=.RTSP\/1\.0 [0-9][0-9][0-9]/)) { status = substr(s, RSTART + RLENGTH - 3, 3); if (status == "200") ok++; else other = other " " status; s = substr(s, RSTART + RLENGTH) } }
      END { print "statuses the pusher read: 200 x " ok + 0 "; other statuses:" (other == "" ? " none" : other) }' "$work/$n.push" | while IFS= read -r line; do hw_line "      pusher  | $line (exit code of the pusher: $code)"; done
  done
  hw_line ''
  starts 'work folder removed' rm -rf "$work"
  hw_read_quiet 'listeners left on the probe'"'"'s port' ss -H -ltn
  # shellcheck disable=SC2016
  hw_reduce '{ if (substr($4, length($4) - length(p) + 1) == p) c++ } END { print c + 0 }' -v p=":$port"
  obs 'listeners left on the probe'"'"'s port after the six runs' "$HW_RED"
  note 'criterion 4, "If not met": without the line, or with other wording, level or instant, the worker refuses every push on this host; branch C applies without a further security review. If the library here refuses a wrong-path push by itself with an RTSP error status, record that as seen: it is stricter, not a FAIL of this criterion.'
}

# ---------------------------------------------------------------------------------------------
# --series
# ---------------------------------------------------------------------------------------------
series() {
  local f logs=0 hits=0 one
  step '9A/H-01.11' SCRIPT 'from the output of step .9, the result line of each permanent case by its name, and a search of the worker'"'"'s log and output of that series for the path texts the series used'
  expected 'near misses refused 7 of 7 (no connect report, 0 bytes in any file) while every control records; the no-line case and the second-ANNOUNCE case refused, each with its own code; in both assignments of the two-camera case the right camera records and the wrong one does not; occurrences of a path text in the worker'"'"'s log and output: 0.'
  user_step 'step .9: make -C apps/capture-worker e2e > <file> 2>&1 ; echo "exit $?" >> <file>     (then --series-output <file>; --series-dir is the result folder the series names in its first line)'
  if hw_log_needed --series-output "$HW_SERIES_OUTPUT"; then
    if [ "$HW_DRY" = 1 ]; then
      hw_line '   would-read: every result line "<case> expect <PASS|FAIL> got <verdict> rc <n> <ok|UNEXPECTED>"; the lines of the permanent cases of the gate by name; the aggregate exit code'
    else
      HW_READ_COUNT=$((HW_READ_COUNT + 1))
      # shellcheck disable=SC2016
      awk '
        $2 == "expect" && $4 == "got" {
          all++; if ($0 ~ /UNEXPECTED/) unexpected++
          if ($1 ~ /(gate|near|announce|foreign|second|noline|unseen|two_cam|both_at_once)/) { gate++; print "permanent case: " $1 " expect " $3 " got " $5 " rc " $7 " " ($0 ~ /UNEXPECTED/ ? "UNEXPECTED" : "ok") }
        }
        /AGGREGATE EXIT CODE/ { aggregate = $NF }
        /^exit [0-9]+$/ { shell = $2 }
        END {
          print "result lines in the series: " all + 0 "; of them UNEXPECTED: " unexpected + 0
          print "result lines whose name marks a permanent case of the gate: " gate + 0
          print "aggregate exit code printed by the series: " (aggregate == "" ? "(not printed)" : aggregate) "; exit code of make as the USER appended it: " (shell == "" ? "(not appended)" : shell)
        }' "$HW_SERIES_OUTPUT" | while IFS= read -r line; do hw_line "      series  | $line"; done
      hw_count 'output of the series' "$HW_SERIES_OUTPUT" INGEST_ANNOUNCE_NOT_MATCHED
      # shellcheck disable=SC2016
      one=$(awk 'index($0, "rtsp://") > 0 { c++ } END { print c + 0 }' "$HW_SERIES_OUTPUT")
      obs 'lines of the output of the series that hold a stream address' "$one"
    fi
    confirm 'the names of the permanent cases (rows 142 and 178 had not landed when this collector was written): a case is taken for one of the gate when its name holds gate, near, announce, foreign, second, noline, unseen, two_cam or both_at_once'
  fi
  if [ "$HW_DRY" = 1 ]; then
    hw_line '   would-count: in every *.jsonl and *.out file one and two levels below --series-dir, the lines that hold a stream address (the path texts of the series travel only inside one)'
  elif [ -n "$HW_SERIES_DIR" ] && [ -d "$HW_SERIES_DIR" ]; then
    HW_READ_COUNT=$((HW_READ_COUNT + 1))
    for f in "$HW_SERIES_DIR"/*.jsonl "$HW_SERIES_DIR"/*.out "$HW_SERIES_DIR"/*/*.jsonl "$HW_SERIES_DIR"/*/*.out; do
      [ -f "$f" ] || continue
      case "$f" in */push*.out | */test.log | */control.log) continue ;; esac
      logs=$((logs + 1))
      # shellcheck disable=SC2016
      one=$(awk 'index($0, "rtsp://") > 0 { c++ } END { print c + 0 }' "$f")
      hits=$((hits + one))
    done
    obs 'worker log and output files read under the series folder' "$logs"
    obs 'lines in them that hold a stream address (path texts in the worker'"'"'s log and output)' "$hits"
    confirm 'the layout of the series folder (which files are the worker'"'"'s log and output, which the pusher'"'"'s own trace, where a path text is expected)'
  else
    HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
    hw_line '   NOT HANDED OVER: --series-dir was not given; the search for path texts is missing from this collection'
  fi
}

case "$HW_MODE" in
  profile) profile ;;
  announce) announce ;;
  series) series ;;
esac
note 'what to record (part 6): the host'"'"'s release line and uname -m (into the header); counts of met, not met, deferred; the two counter figures; the three version lines; "announce line 6 of 6" or the count seen, with level; the series'"'"' result per case name; the two time values of step .5; the three file names. Not: an address of the site, the path texts of the series, the value of any setting of /etc/dems/core.env.'
hw_done
