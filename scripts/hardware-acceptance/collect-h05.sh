#!/bin/bash
# Hardware acceptance, check 9A/H-05 (chapter 2): the address helper as installed.
#   --installed [--service-user U] [--camera-interface IF] [--install-dir D] [--sudo-reads FILE]   step .1
#   --journal --journal-file FILE [--camera-interface IF]                                                step .5
#   --core --core-log FILE [--core-pid N]                                                           step .7
# The five requests to the socket (step .3), the foreign-account attempt (.4) and the restart of
# the Core (.7) are the USER's. This collector sends nothing to the helper's socket.
# Read-only. NOTHING HERE IS PROVEN ON A HOST: this is the instrument of the hardware package.
set -eu
HW_SCRIPT=collect-h05.sh
HW_CHECK='9A/H-05'
HW_CHAPTER=2
HW_MODES='installed journal core'
HW_ACCEPTS='service-user camera-interface install-dir sudo-reads journal-file core-log core-pid'
HW_SUMMARY='owner, mode and hash of the installed helper; its journal lines by verb, result, code; the Core'"'"'s boot lines about it'
case "$0" in */*) HW_DIR=${0%/*} ;; *) HW_DIR=. ;; esac
# shellcheck source=hw-collect-lib.sh
. "$HW_DIR/hw-collect-lib.sh"
hw_init "$@"

HELPER=/usr/local/sbin/dems-core-netalias
SOCKET_UNIT=/etc/systemd/system/dems-core-netalias.socket
SERVICE_UNIT='/etc/systemd/system/dems-core-netalias@.service'
SOCKET=/run/dems-core-netalias/socket
INTERFACE_FILE=/etc/dems/netalias-interface

criterion '1. installed state as stated: 6 of 6 objects (group, socket, two unit files, helper, interface file), the three hashes equal, sudoers lines 0; 2. writable by the service user: 0 of 2 files; 3. refusals: 5 of 5, and the socket refuses the foreign account 1 of 1; 4. journal lines: 5 for 5 calls; addresses on the camera port changed by these calls: 0; 5. the Core'"'"'s start names no fault of the helper: 0 lines; the mismatch of step .8 is named: 1 of 1.'
case "$HW_MODE" in
  installed)
    step '9A/H-05.1' SCRIPT 'the checks of HOST-43 to HOST-47: the group'"'"'s member list; systemctl is-active dems-core-netalias.socket; stat on the socket, the two unit files, the helper and the interface file; namei -l on the helper; sha256sum on the helper and the two unit files; the line count of the interface file; ip -4 route show default; the sudoers search'
    expected 'one group line whose member list is exactly <service-user>; active; socket root dems-netalias 660; unit files root root 644; helper root root 755, no symbolic link, every parent directory root-owned; the three hashes equal those chapter 4 prints; interface file one line, root 644; the default route names another interface; the sudoers search prints 0 after every file name.'
    hw_read_quiet 'the helper group (HOST-43)' getent group dems-netalias
    # shellcheck disable=SC2016
    hw_reduce '{ lines++; n = split($4, m, ","); if ($4 == "") n = 0; members = n; only = (n == 1 && m[1] == u) ? "yes" : (u == "" ? "not compared: --service-user not given" : "no") } END { print "group lines: " lines + 0 "; members: " members + 0 "; the only member is <service-user>: " (lines ? only : "no group") }' -F: -v u="$HW_SERVICE_USER"
    obs 'group dems-netalias' "$HW_RED"
    hw_read 'the socket unit (HOST-44)' systemctl is-active dems-core-netalias.socket
    hw_read 'owner, group, mode: socket node, two unit files, helper, interface file' stat -c '%U %G %a %F %n' "$SOCKET" "$SOCKET_UNIT" "$SERVICE_UNIT" "$HELPER" "$INTERFACE_FILE"
    hw_read 'every component of the helper'"'"'s path (HOST-45)' namei -l "$HELPER"
    # shellcheck disable=SC2016
    hw_reduce '$1 ~ /^[dl-]/ { c++; if ($2 != "root") owner++; if (substr($1, 6, 1) == "w" || substr($1, 9, 1) == "w") writable++; if (substr($1, 1, 1) == "l") links++ } END { print "components: " c + 0 "; not owned by root: " owner + 0 "; writable by group or others: " writable + 0 "; symbolic links: " links + 0 }'
    obs 'path of the helper' "$HW_RED"
    hw_read 'hashes of the installed helper and unit files' sha256sum "$HELPER" "$SOCKET_UNIT" "$SERVICE_UNIT"
    installed=$HW_TEXT
    note 'CHAPTER 4 GOVERNS the hashes (HI-nn prints them). A hash that differs is never accepted: the file is not the reviewed one.'
    if [ -n "$HW_INSTALL_DIR" ] || [ "$HW_DRY" = 1 ]; then
      hw_read 'hashes of the delivery in the product tree, for comparison' sha256sum "${HW_INSTALL_DIR:-<install-dir>}/scripts/host/netalias/dems-core-netalias" "${HW_INSTALL_DIR:-<install-dir>}/scripts/host/netalias/dems-core-netalias.socket" "${HW_INSTALL_DIR:-<install-dir>}/scripts/host/netalias/dems-core-netalias@.service"
      if [ "$HW_DRY" != 1 ]; then
        # shellcheck disable=SC2016
        equal=$(printf '%s\n---\n%s\n' "$installed" "$HW_TEXT" | awk '$1 == "---" { second = 1; next } !second { a[++n] = $1 } second { b[++k] = $1 } END { e = 0; for (i = 1; i <= 3; i++) if (a[i] != "" && a[i] == b[i]) e++; print e " of 3" }')
        obs 'installed hash equals the delivery'"'"'s (helper, socket unit, service unit, in this order)' "$equal"
      fi
    fi
    hw_fixed_file 'the interface file (HOST-46); its content is not printed' "$INTERFACE_FILE"
    if [ "$HW_DRY" != 1 ] && [ -n "$HW_TEXT" ]; then
      # shellcheck disable=SC2016
      hw_reduce '{ n++; if ($0 == i) same = 1 } END { print "lines: " n + 0 "; names the interface given with --camera-interface: " (i == "" ? "not compared" : (same ? "yes" : "no")) }' -v i="$HW_CAMERA_INTERFACE"
      obs 'interface file' "$HW_RED"
    fi
    hw_read_quiet 'the default route' ip -4 route show default
    # shellcheck disable=SC2016
    hw_reduce '{ n++; for (k = 1; k < NF; k++) if ($k == "dev" && $(k + 1) == i) cam++ } END { print "default routes: " n + 0 "; through the camera interface: " (i == "" ? "not compared" : cam + 0) }' -v i="$HW_CAMERA_INTERFACE"
    obs 'default route' "$HW_RED"
    user_step 'sudo grep -r -c netalias /etc/sudoers /etc/sudoers.d     (HOST-47: 0 after every file name)'
    user_step "if the stat of the socket node above was refused: sudo stat -c '%U %G %a' $SOCKET"
    hw_handed 'the administrator readings of step .1' "$HW_SUDO_READS" 'save the outputs of the sudo commands above into one file and pass it with --sudo-reads'
    ;;
  journal)
    step '9A/H-05.5' SCRIPT 'the lines of the helper since step .3 began, each reduced to its fields verb, result, code; the count; then ip -br -4 addr show dev <camera-interface>'
    expected 'exactly 5 lines, one per request of step .3, each with the result of that request; none for step .4; the interface holds exactly one address.'
    user_step "sudo journalctl -u 'dems-core-netalias@*' --since '<time of step .3>' --no-pager -o cat > <file>     (then --journal-file <file>)"
    if hw_log_needed --journal-file "$HW_JOURNAL"; then
      if [ "$HW_DRY" = 1 ]; then
        hw_line '   would-read: of every line that holds verb= : verb, result, code. The caller and the address of a line are never printed.'
      else
        HW_READ_COUNT=$((HW_READ_COUNT + 1))
        # shellcheck disable=SC2016
        awk '
          function field(name,   i, v) { for (i = 1; i <= NF; i++) if (index($i, name "=") == 1) { v = substr($i, length(name) + 2); return (v ~ /^[A-Za-z0-9_-]+$/) ? v : "[not printed]" } return "(absent)" }
          index($0, "verb=") > 0 { c++; print c ": verb=" field("verb") " result=" field("result") " code=" field("code") }
          END { print "helper lines: " c + 0 }' "$HW_JOURNAL" | while IFS= read -r line; do hw_line "      journal | $line"; done
      fi
    fi
    hw_read_quiet 'addresses on the camera port' ip -br -4 addr show dev "${HW_CAMERA_INTERFACE:-<camera-interface>}"
    # shellcheck disable=SC2016
    hw_reduce '{ for (k = 3; k <= NF; k++) if ($k ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\//) c++ } END { print c + 0 }'
    obs 'addresses on the camera port' "$HW_RED"
    ;;
  core)
    step '9A/H-05.7' SCRIPT 'boot lines that name the helper, its grant or the interface file; the supplementary groups of the Core'"'"'s process'
    expected 'capture fence passed; no line names the helper, its grant or the interface file, and the warning CAPTURE_HOST_ALIAS_HELPER_ABSENT of 9A/H-16 is gone; the groups are exactly those of audio and dems-netalias.'
    # NAMES (wave 12, row C1; checked against apps/core-server/src/capture/boot on 2026-10-14): the
    # boot names the helper by the codes CAPTURE_HOST_ALIAS_SOCKET, CAPTURE_HOST_ALIAS_SOCKET_PATH,
    # CAPTURE_HOST_ALIAS_HELPER_UNSAFE, CAPTURE_HOST_ALIAS_GRANT_UNSAFE, CAPTURE_HOST_ALIAS_HELPER_ABSENT
    # and CAPTURE_HOST_INTERFACE_FILE_MISMATCH. The word ALIAS_HELPER alone was removed from the search:
    # no code of the product is that word, and "netalias" does not occur in any of the six.
    if hw_log_needed --core-log "$HW_CORE_LOG"; then
      hw_fields 'Core log' "${HW_CORE_LOG:-<core-log>}" CAPTURE_FENCE_PASSED operation
      if [ "$HW_DRY" = 1 ]; then
        hw_line '   would-count: lines of the Core log that hold a code beginning CAPTURE_HOST_ALIAS_ or CAPTURE_HOST_INTERFACE_FILE_, or the word "netalias" (the lines are not printed; their code and reason fields are)'
      else
        HW_READ_COUNT=$((HW_READ_COUNT + 1))
        # shellcheck disable=SC2016
        awk "$HW_AWK_JSON"'
          { low = tolower($0) }
          index(low, "capture_host_alias_") > 0 || index(low, "capture_host_interface_file_") > 0 || index(low, "netalias") > 0 { c++; print c ": level=" safe(jget($0, "level")) " code=" safe(jget($0, "code")) " reason=" safe(jget($0, "reason")) }
          END { print "boot lines that name the helper, its grant or the interface file: " c + 0 }' "$HW_CORE_LOG" | while IFS= read -r line; do hw_line "      Core log | $line"; done
      fi
      confirm 'that the journal of a real unit carries the code and the reason of a boot line as the members "code" and "reason" (the six codes are the product'"'"'s; the line form was seen on doubles only)'
    fi
    if [ -n "$HW_CORE_PID" ] || [ "$HW_DRY" = 1 ]; then
      hw_proc_lines 'supplementary groups of the Core (HOST-40)' "${HW_CORE_PID:-<core-pid>}" status '^Groups:'
      hw_read_quiet 'the group numbers of audio and the helper group' getent group audio dems-netalias
      # shellcheck disable=SC2016
      hw_reduce '{ printf "%s=%s ", $1, $3 }' -F:
      obs 'group numbers to hold against the Groups line' "$HW_RED"
    fi
    ;;
esac
note 'what to record (part 6): the six state lines as met or not met; "hashes equal: yes"; the five answer lines; the journal count; the address count; the result of .7 and .8. Not: <alias-address>, the interface'"'"'s name, any account name.'
hw_done
