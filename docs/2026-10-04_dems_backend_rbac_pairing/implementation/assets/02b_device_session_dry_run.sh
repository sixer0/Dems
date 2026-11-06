#!/bin/sh
# W02b dry run of apps/mobile/scripts/device-session.sh with stubs (no device, no emulator, no real lock).
# The pre-image and the new script each run in their own scratch root; `adb`, `pgrep` and the
# emulator binary are stubs that record their arguments. Same method as step 35 (13_device_session_dry_run.txt).
#   usage: sh dry_run.sh <pre-image script> <new script> <work dir>
set -u
PRE=$1
NEW=$2
W=$3
rm -rf "$W"
mkdir -p "$W/sdk/platform-tools" "$W/sdk/emulator" "$W/bin"

cat >"$W/sdk/platform-tools/adb" <<'EOF'
#!/bin/sh
# stub adb: records the call, answers from files, talks to no device
echo "adb $*" >>"$STUB_TRACE"
[ "${1:-}" = "-s" ] && { ser=$2; shift 2; } || ser=none
case "$*" in
  start-server) ;;
  get-state) echo device ;;
  "shell getprop sys.boot_completed") echo 1 ;;
  "shell wm dismiss-keyguard")
    # a keyguard without a credential goes away on dismiss; a secure one stays
    [ "$(cat "$STUB_STATE/keyguard.$ser" 2>/dev/null)" = swipe ] && echo false >"$STUB_STATE/keyguard.$ser"
    ;;
  "shell dumpsys window")
    k=$(cat "$STUB_STATE/keyguard.$ser" 2>/dev/null)
    case "$k" in
      true | swipe) printf '  mCurrentFocus=Window{stub u0 NotificationShade}\r\n  isKeyguardShowing=true\r\n' ;;
      false) printf '  mCurrentFocus=Window{stub u0 Launcher}\r\n  isKeyguardShowing=false\r\n' ;;
      *) ;; # unreadable: no output
    esac
    ;;
esac
exit 0
EOF
cat >"$W/bin/pgrep" <<'EOF'
#!/bin/sh
# stub pgrep: records the pattern; prints a PID only when the scenario says the AVD is running
echo "pgrep $*" >>"$STUB_TRACE.pgrep"
[ -s "$STUB_STATE/avd_running" ] && { cat "$STUB_STATE/avd_running"; exit 0; }
exit 1
EOF
cat >"$W/sdk/emulator/emulator" <<'EOF'
#!/bin/sh
# stub emulator: records its arguments and exits
echo "emulator $*" >>"$STUB_TRACE.emu"
exit 0
EOF
chmod +x "$W/sdk/platform-tools/adb" "$W/bin/pgrep" "$W/sdk/emulator/emulator"

run() { # $1 = label, $2 = old|new, $3 = target, $4 = keyguard state for every serial, $5 = avd running? (pid or ""), rest = env assignments
  label=$1 which=$2 target=$3 kg=$4 running=$5
  shift 5
  R="$W/$label/root"
  mkdir -p "$R/apps/mobile/scripts" "$R/node_modules/.bin" "$W/$label/state"
  case "$which" in old) cp "$PRE" "$R/apps/mobile/scripts/device-session.sh" ;; new) cp "$NEW" "$R/apps/mobile/scripts/device-session.sh" ;; esac
  chmod +x "$R/apps/mobile/scripts/device-session.sh"
  for ser in emulator-5554 emulator-5556 emulator-5558; do echo "$kg" >"$W/$label/state/keyguard.$ser"; done
  [ -n "$running" ] && echo "$running" >"$W/$label/state/avd_running"
  # per-serial override: KG_<port>=<state>
  for kv in "$@"; do case "$kv" in KG_*) p=${kv%%=*}; echo "${kv#*=}" >"$W/$label/state/keyguard.emulator-${p#KG_}" ;; esac; done
  envs=""
  for kv in "$@"; do case "$kv" in KG_*) ;; *) envs="$envs $kv" ;; esac; done
  t0=$(date +%s)
  # shellcheck disable=SC2086
  env -i HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" PATH="$W/bin:/usr/bin:/bin:/usr/sbin:/sbin" ANDROID_HOME="$W/sdk" \
    STUB_TRACE="$W/$label/trace" STUB_STATE="$W/$label/state" NO_METRO=1 BOOT_WAIT=10 LOCK_WAIT=5 \
    DEVICE_SESSION_MAX_SECONDS=120 $envs \
    /bin/sh "$R/apps/mobile/scripts/device-session.sh" "$target" "echo ran >'$W/$label/commands_ran'; echo \"AVD_NAME=\${AVD_NAME:-<unset>} SERIAL=\${SERIAL:-<unset>}\" >'$W/$label/commands_env'" \
    >"$W/$label/stdout" 2>"$W/$label/stderr" </dev/null
  st=$?
  t1=$(date +%s)
  ran=no
  [ -f "$W/$label/commands_ran" ] && ran=yes
  printf '%s: exit=%s adb calls=%s commands ran=%s (%s s)\n' "$label" "$st" "$(wc -l <"$W/$label/trace" 2>/dev/null | tr -d ' ')" "$ran" "$((t1 - t0))"
}

show() { # $1 = label
  echo "=== $1: stub adb trace"
  cat "$W/$1/trace" 2>/dev/null
  echo "=== $1: stderr (times stripped)"
  sed -E 's/ [0-9]{2}:[0-9]{2}:[0-9]{2}\]/ HH:MM:SS]/; s/until [0-9:]+ /until HH:MM:SS /; s/watchdog PID [0-9]+/watchdog PID N/; s/PID [0-9]+ written/PID N written/' "$W/$1/stderr" 2>/dev/null
  [ -f "$W/$1/trace.pgrep" ] && { echo "=== $1: stub pgrep calls"; sort -u "$W/$1/trace.pgrep"; }
  [ -f "$W/$1/trace.emu" ] && { echo "=== $1: stub emulator calls"; cat "$W/$1/trace.emu"; }
  [ -f "$W/$1/commands_env" ] && { echo "=== $1: what <commands> saw"; cat "$W/$1/commands_env"; }
  echo "=== $1: .locks of the scratch root"
  ls "$W/$1/root/.locks" 2>/dev/null | tr '\n' ' '
  echo
}

echo "== W02b dry run $(date '+%Y-%m-%d %H:%M:%S')"
echo "pre-image sha256: $(shasum -a 256 "$PRE" | cut -d' ' -f1)"
echo "new       sha256: $(shasum -a 256 "$NEW" | cut -d' ' -f1)"
echo
echo "---- summary"
run old_running_unlocked old phone false 4242
run new_running_unlocked new phone false 4242
run new_running_secure_lock new phone true 4242
run new_running_swipe_keyguard new phone swipe 4242
run new_running_unreadable new phone none 4242
run new_down_default_prefix new phone false ""
run new_down_old_prefix new phone false "" DEMS_AVD_PREFIX=dems_
run new_down_tablet new tablet false ""
run new_down_phone2 new phone2 false ""
run new_both_tablet_locked new both false 4242 KG_5556=true
run new_secure_lock_keep_app new phone true 4242 KEEP_APP=1
run new_any_phone_secure_lock new any-phone true 4242
echo
echo "---- old vs new on a running, unlocked device: adb trace diff (expected: only the three added calls)"
diff "$W/old_running_unlocked/trace" "$W/new_running_unlocked/trace"
echo "(diff exit=$?)"
echo
for l in old_running_unlocked new_running_unlocked new_running_secure_lock new_running_swipe_keyguard new_running_unreadable \
  new_down_default_prefix new_down_old_prefix new_down_tablet new_down_phone2 new_both_tablet_locked new_secure_lock_keep_app new_any_phone_secure_lock; do
  show "$l"
  echo
done
