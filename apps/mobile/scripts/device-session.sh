#!/bin/sh
# DEMS device session: lock + lane helper (Parallel Execution Protocol P3/P4; 05_mobile_plan §5.4).
# Written and tested by step 67. Hard session cap rewritten by step 67b (D93, incident F-83-6).
# Second phone (dems_phone2) and the any-phone / any targets added by step 67c (D100).
# AVD-name prefix (DEMS_AVD_PREFIX, default dems2_) and the screen-lock check (exit 77) added by
# row W02b of the backend task (its D58); the port guard (exit 69 when another AVD holds the
# target's port) by that row's follow-up (D63).
#
# Run it OUTSIDE the sandbox (adb and the emulator need that, D24), from any directory:
#
#   METRO_PORT=8082 apps/mobile/scripts/device-session.sh any-phone '<commands>' # phone lanes: first free phone
#   METRO_PORT=8082 apps/mobile/scripts/device-session.sh phone     '<commands>'
#   METRO_PORT=8082 apps/mobile/scripts/device-session.sh phone2    '<commands>'
#   METRO_PORT=8082 apps/mobile/scripts/device-session.sh tablet    '<commands>'
#   METRO_PORT=8082 apps/mobile/scripts/device-session.sh any       '<commands>' # first free of all three
#   METRO_PORT=8085 apps/mobile/scripts/device-session.sh both      '<commands>' # steps 57 and 59 only
#   NO_METRO=1      apps/mobile/scripts/device-session.sh any-phone '<commands>' # no Metro (installs, launcher)
#
# Targets, AVDs, serials and locks. The AVD of a target is "$DEMS_AVD_PREFIX<target>"; the default
# prefix is dems2_:
#   phone   dems2_phone   emulator-5554  .locks/dems_phone.lock
#   phone2  dems2_phone2  emulator-5558  .locks/dems_phone2.lock   (same pixel_10 profile as phone)
#   tablet  dems2_tablet  emulator-5556  .locks/dems_tablet.lock
#   The dems2_* AVDs were created without a screen lock (W02b, D58). DEMS_AVD_PREFIX=dems_ addresses
#   the older AVDs dems_phone, dems_phone2 and dems_tablet on the same ports; those carry a
#   screen-lock PIN, so a session on them stops with 77 until the user has unlocked them. Lock
#   files, target names, serials and ports do not depend on the prefix (.locks/dems_<target>.lock in
#   every case). The two families share the ports, so only one of them can run: stop the emulators
#   of the other prefix first (this script never stops one).
#   any-phone  the FIRST FREE of phone, phone2; any  the first free of phone, phone2, tablet.
#     Each lock is probed without blocking (lockf -k -t 0), and the probe that succeeds already holds
#     the lock and runs the session, so two lanes can never pick the same device. If every lock is
#     busy, the probes repeat every 2 s until one frees (whichever frees first) or LOCK_WAIT runs out
#     (exit 75). The session logs the serial it got, and SERIAL / ANDROID_SERIAL carry it, so
#     <commands> must use "$SERIAL" (or plain adb), never a hard-coded emulator-5554.
#
# Holding .locks/dems_<target>.lock (for "both": phone first, then tablet), it:
#   1. checks the AVD. If it is down, boots it cold, the P3/D78 way (-port 5554/5558/5556 -no-metrics
#      -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save), detached, writes
#      .locks/<AVD name>.pid (dems2_phone.pid, ...) and .locks/<AVD name>.emulator.log, waits for
#      boot. A running AVD that adb cannot reach is never booted a second time, and no emulator is
#      ever stopped or rebooted here (P3, D78). Port guard: if the target's port is held by an
#      emulator of ANOTHER AVD (the two families share the ports), nothing is booted, the PID file
#      is left as it is and the session stops with 69, naming that AVD and the DEMS_AVD_PREFIX
#      that addresses it; the same when the serial is answered by another AVD than the session's;
#   1b. wakes the screen and dismisses a keyguard that has no credential (input keyevent
#      KEYCODE_WAKEUP, wm dismiss-keyguard), then reads isKeyguardShowing. Still showing means the
#      device has a secure lock (PIN, pattern, password): the session stops with 77 (no Metro, no
#      reverse rule, <commands> do not run; only step 5 follows). It types nothing into a lock
#      screen and changes no lock or security setting; no agent unlocks a device, that is the
#      user's action (D35, D49 of the backend task);
#   2. force-stops com.dems.demo.tablet (D43), unless KEEP_APP=1;
#   3. starts Metro on 127.0.0.1:$METRO_PORT (IPv4 first, D41), waits for packager-status:running,
#      sets the app's bundler location to localhost:8081 (needed on emulators, see set_bundle_host)
#      and maps the device side: adb reverse tcp:8081 -> tcp:$METRO_PORT (H-MB-09) and tcp:4400;
#   4. runs <commands> with /bin/sh in apps/mobile, with these variables exported:
#        SERIAL, ANDROID_SERIAL  the session serial (single-AVD sessions only)
#        AVD_NAME                the AVD's name, prefix included: dems2_phone, dems2_phone2 or
#                                dems2_tablet by default (single-AVD sessions only)
#        SERIALS                 every serial of the session ("emulator-5554 emulator-5556" for both)
#        APP_ID                  com.dems.demo.tablet
#        METRO_PORT, METRO_LOG   lane port and the Metro log file ("Android Bundled" lines)
#        ROOT, APP               workspace root, apps/mobile
#        SHOTS                   docs/2026-09-30_dems_demo_stack_setup/implementation/assets/mobile
#      and adb/emulator on PATH;
#   5. on exit (success, failure, Ctrl-C, cap): stops this session's process groups (<commands>
#      and anything they left running, Metro), force-stops the app (unless KEEP_APP=1) and removes
#      only this session's reverse rules. Emulators and the adb server are never stopped here (P3).
#
# Hard cap (P3, D93). The whole session, from "lock acquired" to "lock released", is capped at
#   DEVICE_SESSION_MAX_SECONDS (default 1800). A background watchdog compares the wall clock with
#   the deadline once a second, so the cap also holds across a host sleep: step 83's session held
#   the tablet lock from 06:58 to 09:16 because the old alarm(2) timer counts only time awake and
#   the Mac was in clamshell sleep from 07:08 to 09:12 (F-83-6). At the deadline the watchdog
#   sends TERM to the process groups this session started (<commands>, Metro) and to the session
#   shell, which then runs step 5 and exits with 142 (Metro and <commands> get KILL after 10 s and
#   5 s). If that shell is still running 30 s later (a hung adb, say), the watchdog freezes it,
#   KILLs those groups and the shell's own hung command, removes the reverse rules itself (lock
#   still held) and KILLs the shell, so lockf exits and the lock is free. If the session shell is
#   killed from outside, the watchdog still stops the groups it started. The watchdog never signals
#   an emulator, the adb server or any process the session did not start.
#
# Examples of <commands>:
#   adb -s "$SERIAL" shell am start -W -a android.intent.action.VIEW -d "demsdemo:///" "$APP_ID"
#   adb -s "$SERIAL" exec-out screencap -p > "$SHOTS/<step>_dems_phone_<name>.png"
#
# Environment: METRO_PORT (default 8081; lanes per P4), NO_METRO=1, KEEP_APP=1,
#   DEMS_CORE_HOST_PORT (optional; 4420-4423, the host port of the Core server or of a lane backend.
#   Set: the session also maps device tcp:4420 -> host tcp:$DEMS_CORE_HOST_PORT and removes that
#   rule at the end; the device side is always tcp:4420. Unset or empty: no tcp:4420 rule is set
#   or removed and the session runs exactly as before. Any other value: exit 64, before any lock),
#   DEMS_AVD_PREFIX (AVD-name prefix, default dems2_; dems_ = the older, PIN-locked AVDs. Letters,
#   digits and underscores only; anything else: exit 64, before any lock),
#   LOCK_WAIT (seconds to wait for a lock, default 1800),
#   DEVICE_SESSION_MAX_SECONDS (hard cap in seconds, default 1800; SESSION_MAX_SECS is the older
#   name and is still read when DEVICE_SESSION_MAX_SECONDS is unset),
#   BOOT_WAIT (seconds to wait for a reboot, default 240), ANDROID_HOME (default ~/Library/Android/sdk).
# Exit status: that of <commands>; 64 usage; 69 device unavailable, or its port or serial belongs
#   to another AVD (port guard, step 1); 70 Metro failed or session setup
#   failed; 75 lock not acquired within LOCK_WAIT (from lockf, or from the any-phone/any wait);
#   77 a device of the session shows a secure screen lock (nothing was entered, <commands> did not
#   run; the user unlocks the device); 142 session cap reached. If the watchdog has to KILL a hung
#   session shell, lockf reports that shell's death instead. any-phone/any return the session's
#   status unchanged (a 75 from <commands> is told apart from "lock busy" by a marker the session
#   writes when it starts).

set -u

usage() {
  echo "usage: [METRO_PORT=8081..8086] [NO_METRO=1] [DEMS_CORE_HOST_PORT=4420..4423] [DEMS_AVD_PREFIX=dems2_] [DEVICE_SESSION_MAX_SECONDS=1800] $0 any-phone|any|phone|phone2|tablet|both '<commands>'" >&2
  exit 64
}

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
SELF="$SCRIPT_DIR/$(basename "$0")"
APP=$(cd "$SCRIPT_DIR/.." && pwd)
ROOT=$(cd "$APP/../.." && pwd)
LOCKS="$ROOT/.locks"
APP_ID=com.dems.demo.tablet
SHOTS="$ROOT/docs/2026-09-30_dems_demo_stack_setup/implementation/assets/mobile"
: "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export ANDROID_HOME PATH APP_ID ROOT APP SHOTS

INNER=0
if [ "${1:-}" = "__inner" ]; then
  INNER=1
  shift
  # any-phone/any: get the caller's stderr back from fd 3 (the picker silences lockf's own "already
  # locked" lines), then tell the picker that the session itself ran (see pick_session).
  if [ -n "${DEMS_SESSION_PICKED:-}" ]; then
    command exec 2>&3 3>&- # not in a { } 2>/dev/null group: that would restore fd 2 afterwards
    echo "${1:-?}" >"$DEMS_SESSION_PICKED"
    unset DEMS_SESSION_PICKED
  fi
fi
AVD=${1:-}
CMDS=${2:-}
[ -n "$CMDS" ] || usage
case "$AVD" in
  phone | dems_phone) AVD=phone ;;
  phone2 | dems_phone2) AVD=phone2 ;;
  tablet | dems_tablet) AVD=tablet ;;
  both) ;;
  any-phone | any) [ "$INNER" -eq 0 ] || usage ;;
  *) usage ;;
esac

# The hard cap in whole seconds. Checked before any lock is taken.
MAX_SECS=${DEVICE_SESSION_MAX_SECONDS:-${SESSION_MAX_SECS:-1800}}
case "$MAX_SECS" in
  '' | 0* | *[!0-9]*)
    echo "DEVICE_SESSION_MAX_SECONDS must be a whole number of seconds above 0 (got '$MAX_SECS')" >&2
    exit 64
    ;;
esac

# Optional Core server host port (04_client_integration_spec §9.6; plan W13). Checked before any lock
# is taken. Unset or empty leaves CORE_HOST_PORT empty, and then nothing below runs for it.
CORE_HOST_PORT=${DEMS_CORE_HOST_PORT:-}
case "$CORE_HOST_PORT" in
  '' | 442[0-3]) ;;
  *)
    echo "DEMS_CORE_HOST_PORT must be 4420-4423 (P4) (got '$CORE_HOST_PORT')" >&2
    exit 64
    ;;
esac

# AVD-name prefix (row W02b, D58). The AVD of a target is "$AVD_PREFIX<target>": dems2_phone,
# dems2_phone2 and dems2_tablet by default (created without a screen lock); DEMS_AVD_PREFIX=dems_
# addresses the older AVDs. Lock files, target names, serials and ports never depend on it. Checked
# before any lock is taken: the value goes into a pgrep pattern and into file names.
AVD_PREFIX="${DEMS_AVD_PREFIX:-dems2_}"
case "$AVD_PREFIX" in
  *[!A-Za-z0-9_]*)
    echo "DEMS_AVD_PREFIX must hold only letters, digits and underscores (got '$AVD_PREFIX')" >&2
    exit 64
    ;;
esac

log() { printf '[device-session %s %s] %s\n' "$AVD" "$(date '+%H:%M:%S')" "$*" >&2; }
serial_of() { case "$1" in phone) echo emulator-5554 ;; phone2) echo emulator-5558 ;; tablet) echo emulator-5556 ;; esac; }
port_of() { case "$1" in phone) echo 5554 ;; phone2) echo 5558 ;; tablet) echo 5556 ;; esac; }

# any-phone / any (step 67c, D100). Tries each candidate lock without blocking: "lockf -k -t 0" either
# takes the lock and runs the session in it (so the probe IS the acquisition and two lanes can never
# pick the same device) or exits 75 at once. 75 is also a legal status of <commands>, so the session
# writes its AVD to the $PICK marker as soon as it starts: marker written = the session ran, and
# its status is returned unchanged; no marker and 75 = lock busy, try the next one. When every
# lock is busy the round repeats every 2 s until one frees (whichever frees first) or LOCK_WAIT
# (wall clock) runs out. Blocked `lockf -t` waiters on a specific lock are woken first by the
# kernel, so a picker never jumps that queue; it takes a lock nobody is waiting for.
pick_session() { # $@ = candidate AVDs in preference order
  case "$W" in '' | *[!0-9]*) echo "LOCK_WAIT must be a whole number of seconds (got '$W')" >&2; exit 64 ;; esac
  PICK=$(mktemp "${TMPDIR:-/tmp}/dems-pick.XXXXXX") || exit 70
  trap 'rm -f "$PICK"' EXIT
  pick_deadline=$(($(date +%s) + W))
  waiting=0
  while :; do
    for a in "$@"; do
      DEMS_SESSION_PICKED=$PICK DEMS_SESSION_TARGET=$AVD \
        /usr/bin/lockf -k -t 0 "$LOCKS/dems_$a.lock" /bin/sh "$SELF" __inner "$a" "$CMDS" 3>&2 2>/dev/null
      pst=$?
      [ -s "$PICK" ] && exit "$pst" # the session ran on $a (it logged its serial); its status is ours
      if [ "$pst" -ne 75 ]; then
        log "lockf could not use .locks/dems_$a.lock (status $pst)"
        exit "$pst"
      fi
    done
    if [ "$waiting" -eq 0 ]; then
      log "all busy ($*); taking the first that frees, LOCK_WAIT ${W} s"
      waiting=1
    fi
    if [ "$(date +%s)" -ge "$pick_deadline" ]; then
      log "no free device ($*) within ${W} s"
      exit 75
    fi
    sleep 2
  done
}

# Outer call: take the lock(s), then re-run this script inside them. lockf releases a lock when its
# child exits, including on failure. Phone is always locked before tablet (no deadlock).
if [ "$INNER" -eq 0 ]; then
  mkdir -p "$LOCKS"
  W=${LOCK_WAIT:-1800}
  case "$AVD" in
    both)
      exec /usr/bin/lockf -k -t "$W" "$LOCKS/dems_phone.lock" \
        /usr/bin/lockf -k -t "$W" "$LOCKS/dems_tablet.lock" /bin/sh "$SELF" __inner both "$CMDS"
      ;;
    any-phone) pick_session phone phone2 ;;
    any) pick_session phone phone2 tablet ;;
    *)
      exec /usr/bin/lockf -k -t "$W" "$LOCKS/dems_$AVD.lock" /bin/sh "$SELF" __inner "$AVD" "$CMDS"
      ;;
  esac
fi

# ---------------------------------------------------------------------------------------------
# Inner call: the lock(s) are held from here on.

is_up() {
  [ "$(adb -s "$1" get-state 2>/dev/null)" = device ] &&
    [ "$(adb -s "$1" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]
}

# The emulator process is the source of truth for "is it running", not adb: right after the adb
# server starts, adb has not found the emulators yet, and a second boot of a running AVD must never
# happen (step 67 hit exactly that; the emulator then aborts with "multiple emulators").
avd_process() { pgrep -f -- "(qemu-system-[a-z0-9_]+|emulator) -avd ${AVD_PREFIX}$1( |\$)" 2>/dev/null | head -n 1; }

wait_up() { # $1 = serial, $2 = seconds
  i=0
  until is_up "$1"; do
    i=$((i + 2))
    [ "$i" -gt "$2" ] && return 1
    sleep 2
  done
}

# Port guard (W02b follow-up, D63). The dems_* and dems2_* AVDs use the same ports, so the emulator
# on a target's port may be the other family's (or one started by `npm run emulator`, which takes
# the first free port). A session must neither boot its AVD onto a held port nor run on that AVD.
#   port_process  any emulator process started with "-port <the target's port>", whatever its AVD;
#   avd_name_of   the AVD name the emulator on a serial reports (read-only; empty: no answer);
#   prefix_hint   which DEMS_AVD_PREFIX addresses the AVD that was found, for the log line.
port_process() { pgrep -f -- "^[^ ]*(qemu-system-[a-z0-9_]+|emulator) (.* )?-port $(port_of "$1")( |\$)" 2>/dev/null | head -n 1; }
avd_name_of() {
  an=$(adb -s "$1" emu avd name 2>/dev/null | head -n 1 | tr -d '\r')
  case "$an" in '' | *[!A-Za-z0-9._-]*) ;; *) echo "$an" ;; esac
}
prefix_hint() { # $1 = target, $2 = AVD name found on its port (may be empty)
  case "$2" in
    ?*"$1")
      hp=${2%"$1"}
      case "$hp" in *[!A-Za-z0-9_]*) ;; *)
        echo "DEMS_AVD_PREFIX=$hp addresses it"
        return
        ;;
      esac
      ;;
  esac
  echo "no DEMS_AVD_PREFIX addresses it as target $1"
}

ensure_avd() {
  s=$(serial_of "$1")
  name="${AVD_PREFIX}$1"
  adb start-server >/dev/null 2>&1
  p=$(avd_process "$1")
  on=""
  [ -n "$p" ] || on=$(avd_name_of "$s")
  # Running: the AVD's own process exists, or (started in a form avd_process does not match) the
  # serial already answers with this AVD's name. Either way it is never booted a second time.
  if [ -n "$p" ] || [ "$on" = "$name" ]; then
    if wait_up "$s" 60; then
      on=$(avd_name_of "$s")
      if [ -n "$on" ] && [ "$on" != "$name" ]; then
        log "$name runs (PID ${p:-unknown}), but $s is answered by AVD '$on': another emulator holds port $(port_of "$1")"
        log "$(prefix_hint "$1" "$on"); or stop that emulator first (this script never stops one)"
        return 1
      fi
      return 0
    fi
    log "$name is running (PID ${p:-unknown}) but adb cannot reach $s in 60 s; not booting a second copy"
    return 1
  fi
  # Down. Before any boot: does another emulator hold the port? Its process (-port <port>), an
  # AVD name answering on the serial, or the serial being a device at all is enough.
  holder=$(port_process "$1")
  if [ -n "$holder" ] || [ -n "$on" ] || [ "$(adb -s "$s" get-state 2>/dev/null)" = device ]; then
    [ -n "$on" ] || [ -z "$holder" ] || on=$(ps -o command= -p "$holder" 2>/dev/null | sed -n 's/.* -avd \([^ ]*\).*/\1/p')
    log "port $(port_of "$1") is held by another emulator: AVD '${on:-unknown}'${holder:+ (PID $holder)}, not $name. Not booting $name; .locks/$name.pid is left as it is"
    log "$(prefix_hint "$1" "$on"); or stop that emulator first (this script never stops one)"
    return 1
  fi
  log "$name ($s) is down; booting it cold the P3/D78 way (-no-snapshot-load -no-snapshot-save)"
  # Detached in its own session, with every inherited descriptor above 2 closed, so the emulator
  # never keeps a lock file open and outlives this session. It is not recorded as a session process
  # group, so neither the cap nor the cleanup ever signals it.
  nohup /usr/bin/perl -MPOSIX -e 'POSIX::setsid(); POSIX::close($_) for 3 .. 255; exec @ARGV or die "exec: $!\n"' -- \
    "$ANDROID_HOME/emulator/emulator" -avd "$name" -port "$(port_of "$1")" \
    -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save \
    >"$LOCKS/$name.emulator.log" 2>&1 </dev/null &
  echo $! >"$LOCKS/$name.pid"
  log "$name PID $(cat "$LOCKS/$name.pid") written to .locks/$name.pid"
  if ! wait_up "$s" "${BOOT_WAIT:-240}"; then
    log "$name did not finish booting in ${BOOT_WAIT:-240} s (log: .locks/$name.emulator.log)"
    return 1
  fi
  # The serial answers: by this AVD? (An emulator adb had not listed yet may have held the port.)
  on=$(avd_name_of "$s")
  if [ -n "$on" ] && [ "$on" != "$name" ]; then
    log "$name was started, but $s is answered by AVD '$on': port $(port_of "$1") was already held, so that start failed (.locks/$name.emulator.log; .locks/$name.pid holds its PID)"
    log "$(prefix_hint "$1" "$on"); or stop that emulator first (this script never stops one)"
    return 1
  fi
  log "$name booted cold; D78: check that the current debug APK is on it (base.apk SHA-256 = the host APK) before testing"
}

case "$AVD" in both) AVDS="phone tablet" ;; *) AVDS=$AVD ;; esac
ALL_SERIALS=""
for a in $AVDS; do ALL_SERIALS="$ALL_SERIALS $(serial_of "$a")"; done
if [ "${NO_METRO:-0}" != 1 ]; then PLANNED_REV="8081 4400"; else PLANNED_REV="4400"; fi
[ -n "$CORE_HOST_PORT" ] && PLANNED_REV="$PLANNED_REV 4420"

# ---- Hard cap: session state and watchdog ------------------------------------------------------
INNER_PID=$$
DEADLINE=$(($(date +%s) + MAX_SECS))
STATE=$(mktemp -d "${TMPDIR:-/tmp}/dems-session.XXXXXX") || exit 70
PGFILE="$STATE/pgids" # one PGID per line: every process group this session starts
: >"$PGFILE"

# Runs "$@" as the leader of a new process group (PGID = its PID), with default INT/QUIT dispositions.
NEWPG='$SIG{INT} = $SIG{QUIT} = "DEFAULT"; setpgrp(0, 0) or die "setpgrp: $!\n"; exec @ARGV or die "exec: $!\n"'

# Process groups are only ever signalled as groups (kill -SIG -PGID), never by bare PID, so a reused
# PID can never be hit.
group_alive() { kill -0 -"$1" 2>/dev/null; }
signal_group() { kill -"$1" -"$2" 2>/dev/null; } # $1 = TERM|KILL, $2 = PGID
stop_group() {                                   # $1 = PGID, $2 = seconds between TERM and KILL
  group_alive "$1" || return 0
  signal_group TERM "$1"
  n=0
  while group_alive "$1" && [ "$n" -lt $(($2 * 2)) ]; do
    sleep 0.5
    n=$((n + 1))
  done
  group_alive "$1" && signal_group KILL "$1"
  return 0
}
record_group() { # $1 = PID started through $NEWPG: wait (max 2 s) until it leads its group, record it
  rn=0
  while ! group_alive "$1" && kill -0 "$1" 2>/dev/null && [ "$rn" -lt 40 ]; do
    sleep 0.05
    rn=$((rn + 1))
  done
  echo "$1" >>"$PGFILE"
}
bounded() { # $1 = seconds; runs the rest as a command and kills it if it takes longer
  bt=$1
  shift
  "$@" >/dev/null 2>&1 &
  bp=$!
  bn=0
  while kill -0 "$bp" 2>/dev/null && [ "$bn" -lt $((bt * 2)) ]; do
    sleep 0.5
    bn=$((bn + 1))
  done
  kill -KILL "$bp" 2>/dev/null
  wait "$bp" 2>/dev/null
  return 0
}

watchdog() {
  trap - EXIT TERM HUP
  while :; do
    if ! kill -0 "$INNER_PID" 2>/dev/null; then
      # The session shell vanished without stopping the watchdog (killed from outside): stop the
      # groups it started so no Metro or command outlives it. The lock is already free, so the
      # device may belong to another session now; its reverse rules are left alone.
      for g in $(cat "$PGFILE" 2>/dev/null); do stop_group "$g" 5; done
      rm -rf "$STATE"
      exit 0
    fi
    [ "$(date +%s)" -ge "$DEADLINE" ] && break
    sleep 1
  done
  trap '' TERM # from here on the session's own cleanup must not stop the watchdog
  : >"$STATE/capped"
  pgs=$(tr '\n' ' ' <"$PGFILE" 2>/dev/null)
  pgs=${pgs% }
  log "hard cap of $MAX_SECS s reached; stopping this session's process groups (${pgs:-none})"
  for g in $pgs; do signal_group TERM "$g"; done
  kill -TERM "$INNER_PID" 2>/dev/null
  w=0
  while kill -0 "$INNER_PID" 2>/dev/null && [ "$w" -lt 30 ]; do
    sleep 1
    w=$((w + 1))
  done
  kill -0 "$INNER_PID" 2>/dev/null || exit 0
  log "session shell $INNER_PID still running 30 s after the cap; forcing it out"
  kill -STOP "$INNER_PID" 2>/dev/null # it starts nothing new from here on
  for g in $pgs; do signal_group KILL "$g"; done
  # The shell's own hung foreground command (adb, curl, sleep): its direct children in its own
  # process group, except this watchdog. A booted emulator leads its own session and is not one.
  me=$(exec /bin/sh -c 'echo $PPID')
  ipg=$(ps -o pgid= -p "$INNER_PID" 2>/dev/null | tr -d ' ')
  if [ -n "$ipg" ]; then
    for c in $(pgrep -P "$INNER_PID" -g "$ipg" 2>/dev/null); do
      [ "$c" = "$me" ] || kill -KILL "$c" 2>/dev/null
    done
  fi
  for s in $ALL_SERIALS; do
    for r in $PLANNED_REV; do bounded 5 adb -s "$s" reverse --remove "tcp:$r"; done
  done
  kill -KILL "$INNER_PID" 2>/dev/null
  log "session shell killed; lockf releases the lock"
  rm -rf "$STATE"
  exit 0
}

watchdog </dev/null &
WD_PID=$!
log "lock held; hard cap $MAX_SECS s, until $(date -r "$DEADLINE" '+%H:%M:%S') (watchdog PID $WD_PID)"
log "session serial:$ALL_SERIALS ($(for a in $AVDS; do printf '%s%s ' "$AVD_PREFIX" "$a"; done | sed 's/ $//'))${DEMS_SESSION_TARGET:+; picked by $DEMS_SESSION_TARGET}"

METRO_PID=""
CMD_PID=""
SERIALS=""
REVERSED=""
cleanup() {
  st=$?
  trap - EXIT
  # Finish the cleanup even if signalled again (the watchdog backstops a hung one). A no-op trap,
  # not an ignore: an ignored signal would be inherited by the adb commands (and any adb server
  # one of them starts) below.
  trap ':' INT TERM HUP
  [ -f "$STATE/capped" ] && st=142
  [ -n "$CMD_PID" ] && stop_group "$CMD_PID" 5
  if [ -n "$METRO_PID" ]; then
    stop_group "$METRO_PID" 10
    wait "$METRO_PID" 2>/dev/null
    log "Metro $METRO_PID stopped"
  fi
  for s in $SERIALS; do
    [ "${KEEP_APP:-0}" = 1 ] || adb -s "$s" shell am force-stop "$APP_ID" >/dev/null 2>&1
    for r in $REVERSED; do adb -s "$s" reverse --remove "tcp:$r" >/dev/null 2>&1; done
  done
  kill -TERM "$WD_PID" 2>/dev/null
  rm -rf "$STATE"
  [ "$st" -eq 142 ] && log "session cap of $MAX_SECS s reached; commands stopped"
  log "session ended with status $st"
  exit "$st"
}
on_signal() {
  [ -f "$STATE/capped" ] && exit 142
  exit "$1"
}
trap cleanup EXIT
trap 'on_signal 130' INT
trap 'on_signal 143' TERM
trap 'on_signal 129' HUP

found=""
for a in $AVDS; do
  ensure_avd "$a" || exit 69
  found="$found $(serial_of "$a")"
done
SERIALS=${found# }
export SERIALS
if [ "$AVD" != both ]; then
  SERIAL=$(serial_of "$AVD")
  ANDROID_SERIAL=$SERIAL
  AVD_NAME=${AVD_PREFIX}$AVD
  export SERIAL ANDROID_SERIAL AVD_NAME
fi

# Screen lock (row W02b, D58; F33). sys.boot_completed = 1 says nothing about the keyguard: at a
# secure keyguard user 0 is still RUNNING_LOCKED, no activity resolves and run-as cannot reach the
# app's data, and until now a session ran on regardless. Credential-free step: wake the screen and
# dismiss a keyguard that has no credential (swipe). Read-only check after it: a keyguard that is
# still showing belongs to a secure lock, and the session stops with 77. Nothing is typed into a lock
# screen and no lock, biometric or other security setting is changed: unlocking a device is the
# user's action, never an agent's (D35, D49).
keyguard_state() { adb -s "$1" shell dumpsys window 2>/dev/null | tr -d '\r' | grep -o 'isKeyguardShowing=[a-z]*' | head -n 1; }
check_keyguard() { # $1 = serial; 0 = no keyguard (or its state cannot be read), 1 = secure lock
  adb -s "$1" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1
  adb -s "$1" shell wm dismiss-keyguard >/dev/null 2>&1
  kn=0
  while kg=$(keyguard_state "$1") && [ "$kg" = "isKeyguardShowing=true" ] && [ "$kn" -lt 10 ]; do
    sleep 1
    kn=$((kn + 1))
  done
  case "$kg" in
    isKeyguardShowing=false) log "$1: screen awake, no keyguard" ;;
    isKeyguardShowing=true)
      log "$1: LOCKED. The keyguard still shows after wake + dismiss, so this device has a secure screen lock (PIN, pattern or password)"
      log "$1: no agent unlocks a device; this script enters no credential and changes no lock setting (D35, D49). The user unlocks it, or use a lock-free AVD (DEMS_AVD_PREFIX, default dems2_)"
      return 1
      ;;
    *) log "$1: WARNING could not read the keyguard state (dumpsys window); going on" ;;
  esac
}
for s in $SERIALS; do check_keyguard "$s" || exit 77; done

if [ "${KEEP_APP:-0}" != 1 ]; then
  for s in $SERIALS; do adb -s "$s" shell am force-stop "$APP_ID" >/dev/null 2>&1; done
fi

# H-MB-09 (step 67 finding): on a stock emulator React Native ignores "localhost" and loads the
# bundle from 10.0.2.2:8081, the HOST loopback, so `adb reverse tcp:8081 tcp:<lane>` is bypassed.
# Setting React Native's own bundler location (the Dev Menu's "Change Bundle Location", pref
# debug_http_host in <package>_preferences.xml) to localhost:8081 sends the app through the reverse
# rule, so every lane keeps the device side on 8081. The debug build is debuggable, so run-as can
# write the file. Other entries in the file are kept. It applies at the next app start.
set_bundle_host() { # $1 = serial
  f="shared_prefs/${APP_ID}_preferences.xml"
  cur=$(adb -s "$1" shell "run-as $APP_ID cat $f" 2>/dev/null | tr -d '\r')
  case "$cur" in
    *'<map'*)
      body=$(printf '%s\n' "$cur" | sed 's#<map */>#<map>#' |
        /usr/bin/grep -v 'name="debug_http_host"' | /usr/bin/grep -v '</map>')
      ;;
    *) body="<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>" ;;
  esac
  printf '%s\n    <string name="debug_http_host">localhost:8081</string>\n</map>\n' "$body" |
    adb -s "$1" shell "run-as $APP_ID sh -c 'mkdir -p shared_prefs && cat > $f'" >/dev/null 2>&1
  if adb -s "$1" shell "run-as $APP_ID cat $f" 2>/dev/null | /usr/bin/grep -q '"debug_http_host">localhost:8081<'; then
    log "$1: bundler location set to localhost:8081 (H-MB-09)"
  else
    log "$1: WARNING could not set the bundler location (is $APP_ID installed?); the app will use 10.0.2.2:8081"
  fi
}

if [ "${NO_METRO:-0}" != 1 ]; then
  METRO_PORT=${METRO_PORT:-8081}
  case "$METRO_PORT" in 808[1-9]) ;; *) log "METRO_PORT must be 8081-8089 (P4)"; exit 64 ;; esac
  export METRO_PORT
  if curl -s -m 2 -o /dev/null "http://127.0.0.1:$METRO_PORT/status"; then
    log "port $METRO_PORT already answers; Metro starts only inside a session (P3). Stop the other one first"
    exit 70
  fi
  METRO_LOG="${TMPDIR:-/tmp}/dems-metro-$METRO_PORT.log"
  export METRO_LOG
  # Metro leads its own process group, so the cleanup and the cap stop it with all its workers.
  (cd "$APP" && EXPO_NO_TELEMETRY=1 NODE_OPTIONS=--dns-result-order=ipv4first \
    exec /usr/bin/perl -e "$NEWPG" -- "$ROOT/node_modules/.bin/expo" start --localhost --port "$METRO_PORT") \
    >"$METRO_LOG" 2>&1 </dev/null &
  METRO_PID=$!
  record_group "$METRO_PID"
  log "Metro PID $METRO_PID (own process group) on 127.0.0.1:$METRO_PORT (log: $METRO_LOG)"
  i=0
  until curl -s -m 2 "http://127.0.0.1:$METRO_PORT/status" 2>/dev/null | grep -q 'packager-status:running'; do
    i=$((i + 1))
    if ! group_alive "$METRO_PID" || [ "$i" -gt 90 ]; then
      log "Metro did not start; last log lines:"
      tail -n 20 "$METRO_LOG" >&2
      exit 70
    fi
    sleep 1
  done
  REVERSED="8081 4400"
  for s in $SERIALS; do
    set_bundle_host "$s"
    adb -s "$s" reverse tcp:8081 "tcp:$METRO_PORT" >/dev/null || exit 69
    adb -s "$s" reverse tcp:4400 tcp:4400 >/dev/null || exit 69
  done
  log "Metro ready; device tcp:8081 -> host tcp:$METRO_PORT, tcp:4400 -> tcp:4400 on $SERIALS"
else
  REVERSED="4400"
  for s in $SERIALS; do adb -s "$s" reverse tcp:4400 tcp:4400 >/dev/null || exit 69; done
  log "no Metro (NO_METRO=1); tcp:4400 -> tcp:4400 on $SERIALS"
fi
# Core server (only with DEMS_CORE_HOST_PORT): the device side is always tcp:4420, the host side is
# the given port. 4420 joins REVERSED first, so the cleanup removes this session's rule and no other.
if [ -n "$CORE_HOST_PORT" ]; then
  REVERSED="$REVERSED 4420"
  for s in $SERIALS; do adb -s "$s" reverse tcp:4420 "tcp:$CORE_HOST_PORT" >/dev/null || exit 69; done
  log "Core server: device tcp:4420 -> host tcp:$CORE_HOST_PORT on $SERIALS"
fi

mkdir -p "$SHOTS"
cd "$APP" || exit 69
# <commands> lead their own process group (the cap and the cleanup stop the whole group, so nothing
# keeps using the device after the lock is released). They keep the caller's stdin (fd 3 is a
# short-lived copy: an asynchronous list would otherwise read /dev/null). The shell waits with the
# interruptible `wait`, so a signal or the watchdog reaches the traps at once.
{ command exec 3<&0; } 2>/dev/null || exec 3</dev/null # stdin may be closed
/usr/bin/perl -e "$NEWPG" -- /bin/sh -c "$CMDS" <&3 3<&- &
CMD_PID=$!
exec 3<&-
record_group "$CMD_PID"
wait "$CMD_PID"
st=$?
[ -f "$STATE/capped" ] && st=142
exit "$st"
