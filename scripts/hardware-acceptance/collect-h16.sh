#!/bin/bash
# Hardware acceptance, check 9A/H-16 (chapter 2): a production Core starts on an unassigned
# selector and refuses a session start.
#   --process --core-pid N --core-log FILE [--service-user U] [--sudo-reads FILE]          step .3
#   --after-refusal --database dems_demo --install-dir D [--sudo-reads FILE]               step .6
# --core-log is the journal of the Core's unit saved by the USER (journalctl -u dems-core.service
# -b --no-pager -o cat). The environment of the Core is NEVER read here: the USER hands over a
# COUNT (see the USER lines the collector prints). The environment file is not opened.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h16.sh
HW_CHECK='9A/H-16'
HW_CHAPTER=2
HW_MODES='process after-refusal'
HW_ACCEPTS='core-pid core-log service-user sudo-reads database install-dir data-dir'
HW_SUMMARY='the operation, the listeners and six process readings of the production Core; the state after the refused session start'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"

criterion '1. the boot log prints the operation REAL_PRODUCTION in run k; 2. listeners of the Core with a local address other than 127.0.0.1: 0; the six process readings as stated: 6 of 6; 3. slots "not assigned": 4 of 4; blocking pre-check items: 4; 4. session start refused: 1 of 1; new session rows: 0; new entries in the media store: 0; 5. sign-ins with the demonstration password refused: n of n seeded operators; 6. missing loopback rule named by the production boot: 1 of 1; after restoring, named 0.'
case "$HW_MODE" in
  process)
    step '9A/H-16.3' SCRIPT 'the capture operation printed in the line "capture fence passed"; the listeners; the core-file limit (HOST-35), the switches of HOST-36 (counts, never the environment), NoNewPrivs (HOST-38), the four capability lines (HOST-39), the supplementary groups (HOST-40), the umask (HOST-42)'
    expected 'operation REAL_PRODUCTION; every listener on 127.0.0.1; core-file limit 0 in both columns; switches found 0; NoNewPrivs: 1; four capability lines ending in sixteen zeros; the groups are exactly those of audio and <helper-group>; umask 0077.'
    if [ "$HW_DRY" != 1 ] && [ -z "$HW_CORE_PID" ]; then hw_fail 2 'refused: --process needs --core-pid (systemctl show dems-core.service -p MainPID --value). Nothing more was read.'; fi
    pid=${HW_CORE_PID:-<core-pid>}
    if hw_log_needed --core-log "$HW_CORE_LOG"; then
      hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_FENCE_PASSED operation
      hw_count 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION CAPTURE_SIGNING_KEY_UNUSABLE CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION DEV_SOURCE_WITHOUT_FLAG
    fi
    hw_read_quiet 'listening TCP sockets (all accounts; without administrator rights the owner is not shown)' ss -H -ltn
    # shellcheck disable=SC2016
    hw_reduce '{ c++; if ($4 !~ /^127\./ && $4 !~ /^\[::1\]/) other++ } END { print (c + 0) " listeners on this host; with a local address that is not a loopback address: " (other + 0) }'
    obs 'listening sockets' "$HW_RED"
    user_step "sudo ss -H -ltnp | grep 'pid=$pid,' | awk '{print \$4}'     (the local addresses of the Core's listeners only, HOST-24; under a line '## listeners' of the file for --sudo-reads)"
    hw_proc_lines 'core-file limit (HOST-35)' "$pid" limits '^Max core file size'
    if [ "$HW_DRY" = 1 ]; then
      hw_line "   would-read-file (command line, HOST-36) | /proc/$pid/cmdline  (reduced to counts of switches that begin --report, --diagnostic, --heap, --inspect; no argument is printed)"
    elif [ -r "$HW_ROOT/proc/$pid/cmdline" ]; then
      HW_READ_COUNT=$((HW_READ_COUNT + 1))
      found=0
      total=0
      while IFS= read -r -d '' arg || [ -n "$arg" ]; do
        total=$((total + 1))
        case "$arg" in --report* | --diagnostic* | --heap* | --inspect*) found=$((found + 1)) ;; esac
      done <"$HW_ROOT/proc/$pid/cmdline"
      obs 'arguments of the Core' "$total"
      obs 'of them a diagnostic-report, heap or debugger switch (HOST-36)' "$found"
    else
      HW_MISS_COUNT=$((HW_MISS_COUNT + 1))
      hw_line '   NOT COLLECTED: /proc/<core-pid>/cmdline is not readable by this account'
    fi
    user_step "sudo tr '\\0' '\\n' < /proc/$pid/environ | grep -c '^NODE_OPTIONS='     (HOST-36: it prints ONE NUMBER; hand over the number only, never the environment, under a line '## node-options')"
    hw_proc_lines 'NoNewPrivs (HOST-38), capabilities (HOST-39), groups (HOST-40), umask (HOST-42)' "$pid" status '^(NoNewPrivs|CapPrm|CapEff|CapBnd|CapAmb|Groups|Umask):'
    hw_read_quiet 'the group numbers of audio and the helper group (HOST-40)' getent group audio dems-netalias
    # shellcheck disable=SC2016
    hw_reduce '{ printf "%s=%s ", $1, $3 }' -F:
    obs 'group numbers to hold against the Groups line (member lists are not printed)' "$HW_RED"
    hw_handed 'the administrator readings of step .3 (listeners, the NODE_OPTIONS count)' "$HW_SUDO_READS" 'save the outputs of the two sudo commands above into one file and pass it with --sudo-reads'
    ;;
  after-refusal)
    step '9A/H-16.6' SCRIPT 'npm run db:status -- --database dems_demo; the row count of the session table; the number of entries under <data-dir>/media/sessions'
    expected 'exit code 0; the session row count equals the count of PREP-09 step 4; 0 entries under the media store.'
    if [ "$HW_DRY" != 1 ]; then
      [ -n "$HW_DATABASE" ] && [ -n "$HW_INSTALL_DIR" ] || hw_fail 2 'refused: --after-refusal needs --database and --install-dir. Nothing more was read.'
    fi
    note 'db:status is the product'"'"'s own read-only command; it reads its database settings itself. Only its exit code, the schema line and the session rows are kept here.'
    hw_read_quiet 'the state of the database' npm --prefix "${HW_INSTALL_DIR:-<install-dir>}" run db:status -- --database "${HW_DATABASE:-dems_demo}"
    obs 'exit code of db:status' "$HW_CODE"
    # shellcheck disable=SC2016
    hw_reduce '$1 == "sessions" && $2 ~ /^[0-9]+$/ { print $2; found = 1 } END { if (!found) print "not found in the output" }'
    obs 'rows of the table sessions' "$HW_RED"
    # shellcheck disable=SC2016
    hw_reduce 'tolower($0) ~ /schema version/ { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9]+$/) { print $i; exit } }'
    obs 'schema version printed' "${HW_RED:-not found in the output}"
    hw_handed 'entries under the media store' "$HW_SUDO_READS" 'sudo find <data-dir>/media/sessions -mindepth 1 -maxdepth 1 | wc -l     (prints one number; into the file for --sudo-reads)'
    ;;
esac
note 'what to record (part 6): the start-command form (words only); the run number in which it started; codes of refused runs; the six process readings; the two counts of .4; "refused, 0 rows, 0 entries"; n of n; the outcome of .9; the file names. Not: any value of the environment file, an operator'"'"'s name, the key'"'"'s location beyond "data directory".'
hw_done
