#!/bin/sh
# W02b follow-up, part A: dry run of the port guard in apps/mobile/scripts/device-session.sh.
# No device, no emulator, no real lock: each case runs a copy of the script in its own scratch
# root, with stubs for `adb`, `pgrep`, `ps` and the emulator binary that record their arguments.
#   usage: sh 02b_followup_dry_run.sh <script before the follow-up> <new script> <work dir>
# State of a case (files in <case>/state):
#   up.<serial>          exists: `adb get-state` says "device" and boot_completed is 1
#   avdname.<serial>     the name `adb emu avd name` reports (absent: the console does not answer)
#   keyguard.<serial>    true | false
#   avd_running.<avd>    PID printed for the script's own-AVD pattern (pgrep ... -avd <name>)
#   port_holder.<port>   PID printed for the port pattern (pgrep ... -port <port>)
#   psline.<pid>         the command line `ps -o command= -p <pid>` prints
#   late_foreign         if present, the stub emulator "fails": the serial comes up as THAT AVD
set -u
PRE=$1
NEW=$2
W=$3
rm -rf "$W"
mkdir -p "$W/sdk/platform-tools" "$W/sdk/emulator" "$W/bin"

cat >"$W/sdk/platform-tools/adb" <<'EOF'
#!/bin/sh
# stub adb: records the call, answers from the state files, talks to no device
echo "adb $*" >>"$STUB_TRACE"
[ "${1:-}" = "-s" ] && { ser=$2; shift 2; } || ser=none
case "$*" in
  start-server) ;;
  get-state) [ -f "$STUB_STATE/up.$ser" ] && echo device || { echo "error: device '$ser' not found" >&2; exit 1; } ;;
  "shell getprop sys.boot_completed") [ -f "$STUB_STATE/up.$ser" ] && echo 1 ;;
  "emu avd name") [ -f "$STUB_STATE/avdname.$ser" ] && printf '%s\r\nOK\r\n' "$(cat "$STUB_STATE/avdname.$ser")" || exit 1 ;;
  "shell dumpsys window") printf '  isKeyguardShowing=%s\r\n' "$(cat "$STUB_STATE/keyguard.$ser" 2>/dev/null || echo false)" ;;
esac
exit 0
EOF
cat >"$W/bin/pgrep" <<'EOF'
#!/bin/sh
# stub pgrep: records the pattern. The port pattern is answered from port_holder, the own-AVD
# pattern from avd_running.
echo "pgrep $*" >>"$STUB_TRACE.pgrep"
case "$*" in
  *"-port "*) f="$STUB_STATE/port_holder.$(echo "$*" | sed -n 's/.*-port \([0-9]*\).*/\1/p')" ;;
  *) f="$STUB_STATE/avd_running.$(echo "$*" | sed -n 's/.* -avd \([A-Za-z0-9_]*\)(.*/\1/p')" ;;
esac
[ -s "$f" ] && { cat "$f"; exit 0; }
exit 1
EOF
cat >"$W/bin/ps" <<'EOF'
#!/bin/sh
# stub ps: the process line of a stubbed PID; anything else goes to the real ps
if [ "${1:-}" = "-o" ] && [ "${2:-}" = "command=" ] && [ "${3:-}" = "-p" ] && [ -f "$STUB_STATE/psline.${4:-}" ]; then
  cat "$STUB_STATE/psline.$4"
  exit 0
fi
exec /bin/ps "$@"
EOF
cat >"$W/sdk/emulator/emulator" <<'EOF'
#!/bin/sh
# stub emulator: records its arguments; the "device" then answers on the port's serial
echo "emulator $*" >>"$STUB_TRACE.emu"
avd="" port=""
while [ $# -gt 0 ]; do
  case "$1" in -avd) avd=$2; shift ;; -port) port=$2; shift ;; esac
  shift
done
: >"$STUB_STATE/up.emulator-$port"
if [ -f "$STUB_STATE/late_foreign" ]; then cat "$STUB_STATE/late_foreign" >"$STUB_STATE/avdname.emulator-$port"; else echo "$avd" >"$STUB_STATE/avdname.emulator-$port"; fi
exit 0
EOF
chmod +x "$W/sdk/platform-tools/adb" "$W/bin/pgrep" "$W/bin/ps" "$W/sdk/emulator/emulator"

# run <label> <old|new> <target> [KEY=VALUE ...]
#   state keys: up=<serial,...> name.<port>=<avd> kg.<port>=<true|false> own.<avd>=<pid> holder.<port>=<pid>
#               psline.<pid>=<line> late=<avd> pidfile=<avd name> ; anything else is an env assignment
run() {
  label=$1 which=$2 target=$3
  shift 3
  R="$W/$label/root"
  ST="$W/$label/state"
  mkdir -p "$R/apps/mobile/scripts" "$R/.locks" "$ST"
  case "$which" in old) cp "$PRE" "$R/apps/mobile/scripts/device-session.sh" ;; new) cp "$NEW" "$R/apps/mobile/scripts/device-session.sh" ;; esac
  chmod +x "$R/apps/mobile/scripts/device-session.sh"
  envs=""
  pidfile=""
  for kv in "$@"; do
    k=${kv%%=*}
    v=${kv#*=}
    case "$k" in
      up) for p in $(echo "$v" | tr ',' ' '); do : >"$ST/up.emulator-$p"; done ;;
      name.*) echo "$v" >"$ST/avdname.emulator-${k#name.}" ;;
      kg.*) echo "$v" >"$ST/keyguard.emulator-${k#kg.}" ;;
      own.*) echo "$v" >"$ST/avd_running.${k#own.}" ;;
      holder.*) echo "$v" >"$ST/port_holder.${k#holder.}" ;;
      psline.*) echo "$v" >"$ST/psline.${k#psline.}" ;;
      late) echo "$v" >"$ST/late_foreign" ;;
      pidfile)
        pidfile="$R/.locks/$v.pid"
        echo 11111 >"$pidfile"
        touch -t 202610010000 "$pidfile"
        ;;
      *) envs="$envs $kv" ;;
    esac
  done
  before=""
  [ -n "$pidfile" ] && before=$(stat -f '%z %m' "$pidfile")
  # shellcheck disable=SC2086
  env -i HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" PATH="$W/bin:/usr/bin:/bin:/usr/sbin:/sbin" ANDROID_HOME="$W/sdk" \
    STUB_TRACE="$W/$label/trace" STUB_STATE="$ST" NO_METRO=1 BOOT_WAIT=10 LOCK_WAIT=5 \
    DEVICE_SESSION_MAX_SECONDS=120 $envs \
    /bin/sh "$R/apps/mobile/scripts/device-session.sh" "$target" "echo ran >'$W/$label/commands_ran'" \
    >"$W/$label/stdout" 2>"$W/$label/stderr" </dev/null
  st=$?
  ran=no
  [ -f "$W/$label/commands_ran" ] && ran=yes
  boots=0
  [ -f "$W/$label/trace.emu" ] && boots=$(wc -l <"$W/$label/trace.emu" | tr -d ' ')
  pf=""
  if [ -n "$pidfile" ]; then
    if [ "$(stat -f '%z %m' "$pidfile")" = "$before" ] && [ "$(cat "$pidfile")" = 11111 ]; then pf="; pre-existing PID file: UNTOUCHED"; else pf="; pre-existing PID file: CHANGED"; fi
  fi
  printf '%s: exit=%s adb calls=%s emulator boots=%s commands ran=%s%s\n' "$label" "$st" "$(wc -l <"$W/$label/trace" 2>/dev/null | tr -d ' ')" "$boots" "$ran" "$pf"
}

show() { # $1 = label
  echo "=== $1: stub adb trace"
  cat "$W/$1/trace" 2>/dev/null
  echo "=== $1: stderr (times stripped)"
  sed -E 's/ [0-9]{2}:[0-9]{2}:[0-9]{2}\]/ HH:MM:SS]/; s/until [0-9:]+ /until HH:MM:SS /; s/watchdog PID [0-9]+/watchdog PID N/; s/PID [0-9]+ written/PID N written/' "$W/$1/stderr" 2>/dev/null
  [ -f "$W/$1/trace.pgrep" ] && { echo "=== $1: stub pgrep calls"; cat "$W/$1/trace.pgrep"; }
  if [ -f "$W/$1/trace.emu" ]; then echo "=== $1: stub emulator calls"; cat "$W/$1/trace.emu"; else echo "=== $1: stub emulator calls: none"; fi
  echo "=== $1: .locks of the scratch root: $(ls "$W/$1/root/.locks" 2>/dev/null | tr '\n' ' ')"
}

Q=/Users/x/Library/Android/sdk/emulator/qemu/darwin-aarch64/qemu-system-aarch64
echo "== W02b follow-up dry run (port guard) $(date '+%Y-%m-%d %H:%M:%S')"
echo "before the follow-up sha256: $(shasum -a 256 "$PRE" | cut -d' ' -f1)"
echo "new                  sha256: $(shasum -a 256 "$NEW" | cut -d' ' -f1)"
echo
echo "---- summary"
echo "-- (2) the session's own AVD is running"
run old_own_running old phone up=5554 name.5554=dems2_phone own.dems2_phone=4242
run new_own_running new phone up=5554 name.5554=dems2_phone own.dems2_phone=4242
run new_own_running_console_silent new phone up=5554 own.dems2_phone=4242
run new_own_running_secure_lock new phone up=5554 name.5554=dems2_phone own.dems2_phone=4242 kg.5554=true
run new_own_running_other_form new phone up=5554 name.5554=dems2_phone
echo "-- (3) nothing on the port"
run old_down old phone pidfile=dems2_phone
run new_down new phone pidfile=dems2_phone
run new_down_tablet new tablet
run new_down_old_prefix new phone DEMS_AVD_PREFIX=dems_
echo "-- (1) another emulator holds the port"
run new_foreign_process_and_name new phone up=5554 name.5554=dems_phone holder.5554=7001 "psline.7001=$Q -avd dems_phone -port 5554 -no-metrics" pidfile=dems2_phone
run new_foreign_process_console_silent new phone holder.5554=7001 "psline.7001=$Q -avd dems_phone -port 5554 -no-metrics" pidfile=dems2_phone
run new_foreign_no_port_argument new phone up=5554 name.5554=dems_tablet pidfile=dems2_phone
run new_foreign_serial_only new phone up=5554 pidfile=dems2_phone
run new_old_prefix_vs_new_emulator new phone DEMS_AVD_PREFIX=dems_ up=5554 name.5554=dems2_phone holder.5554=7002 "psline.7002=$Q -avd dems2_phone -port 5554 -no-metrics" pidfile=dems_phone
run new_both_tablet_port_foreign new both up=5554,5556 name.5554=dems2_phone name.5556=dems_tablet own.dems2_phone=4242 holder.5556=7003 "psline.7003=$Q -avd dems_tablet -port 5556 -no-metrics"
run new_own_process_but_serial_foreign new phone up=5554 name.5554=dems_phone own.dems2_phone=4242
run new_foreign_seen_only_after_boot new phone late=dems_phone
echo
echo "---- (2) old vs new, own AVD running: adb trace diff (expected: one added read-only call)"
diff "$W/old_own_running/trace" "$W/new_own_running/trace"
echo "(diff exit=$?)"
echo "---- (2) old vs new, own AVD running: log lines (times stripped)"
for l in old_own_running new_own_running; do sed -E 's/ [0-9]{2}:[0-9]{2}:[0-9]{2}\]/ HH:MM:SS]/; s/until [0-9:]+ /until HH:MM:SS /; s/watchdog PID [0-9]+/watchdog PID N/' "$W/$l/stderr" >"$W/$l/stderr.n"; done
diff "$W/old_own_running/stderr.n" "$W/new_own_running/stderr.n" && echo "log lines IDENTICAL"
echo "---- (3) old vs new, nothing on the port: adb trace diff (expected: added read-only calls only)"
diff "$W/old_down/trace" "$W/new_down/trace"
echo "(diff exit=$?)"
echo "---- (3) old vs new, nothing on the port: emulator call"
diff "$W/old_down/trace.emu" "$W/new_down/trace.emu" && echo "emulator call IDENTICAL: $(cat "$W/new_down/trace.emu")"
echo
for l in new_own_running new_own_running_console_silent new_own_running_secure_lock new_own_running_other_form old_down new_down new_down_tablet new_down_old_prefix \
  new_foreign_process_and_name new_foreign_process_console_silent new_foreign_no_port_argument new_foreign_serial_only \
  new_old_prefix_vs_new_emulator new_both_tablet_port_foreign new_own_process_but_serial_foreign new_foreign_seen_only_after_boot; do
  show "$l"
  echo
done
