#!/bin/sh
# DEMS emulators: screen lock and fingerprint, FOR THE USER (backend task, row W02b follow-up;
# decisions D35, D49, D60, D63).
#
# The dems2_* emulators are created without a screen lock, so Android offers no fingerprint and the
# app's biometric sign-in cannot be tried on them. This helper lets the USER give them a lock PIN
# and one enrolled fingerprint, open them after a cold boot, and take the lock off again.
#
#   apps/mobile/scripts/emulator-user-lock.sh status [phone|phone2|tablet|all]   # read-only; any caller
#   apps/mobile/scripts/emulator-user-lock.sh setup  [phone|phone2|tablet|all]   # USER, own Terminal
#   apps/mobile/scripts/emulator-user-lock.sh unlock [phone|phone2|tablet|all]   # USER, own Terminal
#   apps/mobile/scripts/emulator-user-lock.sh remove [phone|phone2|tablet|all]   # USER, own Terminal
#   (no target means all. Run it outside the agent sandbox: adb needs that.)
#
# WHO MAY RUN WHAT. Setting, changing or clearing a device lock, enrolling a fingerprint and typing
# a PIN on a lock screen are the user's actions. NO AGENT RUNS setup, unlock OR remove, with or
# without anyone's approval. The script holds that line where it can: those three actions stop with
# exit 77, before a single adb call, unless standard input AND standard output are terminals.
# Agents never work around that check: no `script`, no pseudo-terminal, no expect, no sourcing of
# this file to call its functions against a real device, no running its adb commands by hand.
# `status` only reads (get-state, getprop, emu avd name, dumpsys) and is open to every caller.
#
# Targets and serials are those of device-session.sh: phone emulator-5554, phone2 emulator-5558,
# tablet emulator-5556. The AVD of a target is "$DEMS_AVD_PREFIX<target>" (default prefix dems2_).
# setup, unlock and remove REFUSE a serial whose emulator reports another AVD name (exit 69,
# nothing sent to it), so they cannot touch the older dems_* AVDs or any other emulator by mistake.
#
# status  per device, one line: AVD name, isKeyguardShowing, CredentialType, fingerprint count and
#         "lock screen disabled" (IsLockScreenDisabled of `dumpsys lock_settings`, the value that
#         `locksettings get-disabled` prints; the locksettings command itself is not used here,
#         because it is not a pure read once a credential is set). No lock is taken.
# setup   per device, HOLDING .locks/dems_<target>.lock (lockf, so it queues behind a running device
#         session and never interleaves with one):
#           - "already set up" and nothing else, if a credential exists and a fingerprint is enrolled;
#           - LOCKED (keyguard showing with a credential): reported and skipped; run unlock first;
#           - else the documented procedure: locksettings set-pin <PIN> (skipped if a PIN exists);
#             am start -a android.settings.BIOMETRIC_ENROLL; the PIN and ENTER; three taps on the
#             MORE / I AGREE position (phone 911,2266; tablet 1776,1280); `emu finger touch 1` /
#             `emu finger remove 1` until `dumpsys fingerprint` reports a count of 1, eight rounds at
#             most; KEYCODE_HOME. The enrolment screens are FLAG_SECURE, so the helper works blind
#             and judges by dumpsys only. Result line: "set up: PIN yes, fingerprint count N"; with
#             N = 0 it prints the steps to finish by hand in the emulator window.
# unlock  per device, holding the same lock: if the keyguard shows, wake, bring up the PIN pad
#         (wm dismiss-keyguard), type the PIN, ENTER, then read isKeyguardShowing. One attempt.
# remove  per device, holding the same lock: locksettings clear --old <PIN> (back to lock-free;
#         Android drops the enrolled fingerprints with the lock). A LOCKED device is skipped.
#
# The PIN. The default is the user's chosen emulator test value (D60): a throwaway test fixture of
# these local virtual devices, not a secret. DEMS_EMULATOR_PIN overrides it (digits only, 4 to 8).
# The script never prints the PIN. Trade-off the user accepted: with a PIN, every cold boot leaves
# an emulator at the keyguard (device-session.sh then stops with 77) until `unlock` is run.
#
# Environment: DEMS_EMULATOR_PIN (see above), DEMS_AVD_PREFIX (default dems2_; letters, digits,
#   underscores), LOCK_WAIT (seconds to wait for a device lock, default 1800),
#   ANDROID_HOME (default ~/Library/Android/sdk).
# Exit status: 0 every addressed device is in the wanted state; 1 at least one is not (locked and
#   skipped, fingerprint not enrolled, wrong PIN, lock of another kind); 64 usage or a bad value;
#   69 a device is unavailable (not running, not booted, another AVD on its port, lock state
#   unreadable); 75 a device lock stayed busy for LOCK_WAIT; 77 setup, unlock or remove was not
#   started from a user terminal. With several devices: 69 wins over 75, 75 over 1.
# Library mode (stub tests only, implementation/assets/02b_user_lock_test.sh of the backend task):
#   DEMS_USER_LOCK_LIB=1 makes the file define its functions and return without running anything.
#   Executed that way it does nothing at all, so the variable is no way around the terminal check.

set -u

usage() {
  echo "usage: [DEMS_EMULATOR_PIN=<4 to 8 digits>] [DEMS_AVD_PREFIX=dems2_] [LOCK_WAIT=1800] $0 status|setup|unlock|remove [phone|phone2|tablet|all]" >&2
  exit 64
}

: "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export ANDROID_HOME PATH

PIN="${DEMS_EMULATOR_PIN:-9999}"
AVD_PREFIX="${DEMS_AVD_PREFIX:-dems2_}"
LOCK_WAIT_S="${LOCK_WAIT:-1800}"
PAUSE=2  # seconds between two blind steps of the enrolment
TAPS=3   # taps on the MORE / I AGREE position (MORE once or twice, then I AGREE)
ROUNDS=8 # sensor touches at most (three were enough on these AVDs)

say() { printf '%s\n' "$*"; }

check_config() { # exit 64 on a bad value; the PIN is never echoed
  pin_ok=0
  case "$PIN" in
    '' | *[!0-9]*) ;;
    *) [ "${#PIN}" -ge 4 ] && [ "${#PIN}" -le 8 ] && pin_ok=1 ;;
  esac
  if [ "$pin_ok" -ne 1 ]; then
    echo "DEMS_EMULATOR_PIN must be 4 to 8 digits (the value is not shown)" >&2
    exit 64
  fi
  case "$AVD_PREFIX" in
    *[!A-Za-z0-9_]*)
      echo "DEMS_AVD_PREFIX must hold only letters, digits and underscores (got '$AVD_PREFIX')" >&2
      exit 64
      ;;
  esac
  case "$LOCK_WAIT_S" in
    '' | *[!0-9]*)
      echo "LOCK_WAIT must be a whole number of seconds (got '$LOCK_WAIT_S')" >&2
      exit 64
      ;;
  esac
}

init_paths() {
  SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
  SELF="$SCRIPT_DIR/$(basename "$0")"
  ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)
  LOCKS="$ROOT/.locks"
}

# The one gate of setup, unlock and remove. Called before any adb command.
require_user_terminal() { # $1 = action
  if [ -t 0 ] && [ -t 1 ]; then return 0; fi
  echo "emulator-user-lock.sh $1: this action is the user's; run it in your own Terminal (no agent sets, opens or removes a device lock)" >&2
  exit 77
}

serial_of() { case "$1" in phone) echo emulator-5554 ;; phone2) echo emulator-5558 ;; tablet) echo emulator-5556 ;; esac; }
# The MORE / I AGREE button of "Set up Pixel Imprint" (bottom right; root README, emulator section).
tap_x() { case "$1" in tablet) echo 1776 ;; *) echo 911 ;; esac; }
tap_y() { case "$1" in tablet) echo 1280 ;; *) echo 2266 ;; esac; }

# ---- read-only queries -------------------------------------------------------------------------
is_up() {
  [ "$(adb -s "$1" get-state 2>/dev/null)" = device ] &&
    [ "$(adb -s "$1" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]
}
avd_name_of() {
  an=$(adb -s "$1" emu avd name 2>/dev/null | head -n 1 | tr -d '\r')
  case "$an" in '' | *[!A-Za-z0-9._-]*) ;; *) echo "$an" ;; esac
}
keyguard_showing() { # prints true, false or nothing (unreadable)
  adb -s "$1" shell dumpsys window 2>/dev/null | tr -d '\r' | grep -o 'isKeyguardShowing=[a-z]*' | head -n 1 | cut -d= -f2
}
read_lock() { # $1 = serial; sets CRED (NONE, PIN, PATTERN, PASSWORD; empty = unreadable) and DISABLED
  lk=$(adb -s "$1" shell dumpsys lock_settings 2>/dev/null | tr -d '\r')
  CRED=$(printf '%s\n' "$lk" | sed -n 's/.*CredentialType: *\([A-Z_]*\).*/\1/p' | head -n 1)
  DISABLED=$(printf '%s\n' "$lk" | sed -n 's/.*IsLockScreenDisabled: *\([a-z]*\).*/\1/p' | head -n 1)
}
fingerprint_count() { # prints the enrolled count of user 0, or nothing (unreadable)
  adb -s "$1" shell dumpsys fingerprint 2>/dev/null | tr -d '\r' | grep -o '"count":[0-9]*' | head -n 1 | cut -d: -f2
}

# ---- status (read-only) ------------------------------------------------------------------------
status_device() { # $1 = target
  S=$(serial_of "$1")
  if ! is_up "$S"; then
    say "$1 ($S): not running, or not booted yet"
    return 69
  fi
  NAME=$(avd_name_of "$S")
  read_lock "$S"
  kg=$(keyguard_showing "$S")
  fp=$(fingerprint_count "$S")
  other=""
  [ "$NAME" = "${AVD_PREFIX}$1" ] || other="   <- not ${AVD_PREFIX}$1: another AVD holds this port"
  say "$1 ($S): AVD ${NAME:-unknown}, isKeyguardShowing=${kg:-unreadable}, CredentialType=${CRED:-unreadable}, fingerprint count=${fp:-unreadable}, lock screen disabled=${DISABLED:-unreadable}$other"
}

# ---- the user's actions (reached only through main, behind the terminal check) --------------------
open_device() { # $1 = target; sets S and NAME. 69: down, or another AVD (nothing was sent to it)
  S=$(serial_of "$1")
  if ! is_up "$S"; then
    say "$1 ($S): not running, or not booted yet. Nothing done (device-session.sh boots it)"
    return 69
  fi
  NAME=$(avd_name_of "$S")
  if [ "$NAME" != "${AVD_PREFIX}$1" ]; then
    say "$1 ($S): REFUSED. The emulator on this port is '${NAME:-unknown}', not ${AVD_PREFIX}$1 (DEMS_AVD_PREFIX=$AVD_PREFIX). Nothing was sent to it"
    return 69
  fi
}

manual_steps() { # $1 = target (S is set): how the user finishes the enrolment by hand
  say "  The PIN is set, but no fingerprint is enrolled yet (the enrolment screens are FLAG_SECURE, so this helper works blind)."
  say "  To finish by hand, in the window of that emulator:"
  say "    1. Settings > Security & privacy > Device unlock > Fingerprint Unlock, and enter the PIN;"
  say "    2. on \"Set up Pixel Imprint\" press MORE until the button reads I AGREE, then I AGREE;"
  say "    3. at \"Touch the sensor\", in a Terminal:  adb -s $S emu finger touch 1; adb -s $S emu finger remove 1"
  say "       repeat it until \"Fingerprint added\" shows, then DONE;"
  say "    4. check:  $0 status $1   (fingerprint count=1)"
  say "  Or start over:  $0 remove $1  and then  $0 setup $1"
}

setup_device() { # $1 = target. 0 = set up (now or before); 1 = not completed; 69 = unavailable
  open_device "$1" || return $?
  read_lock "$S"
  fp=$(fingerprint_count "$S")
  kg=$(keyguard_showing "$S")
  if [ -z "$CRED" ]; then
    say "$1 ($S, $NAME): the lock state cannot be read (dumpsys lock_settings). Nothing done"
    return 69
  fi
  if [ "$CRED" != NONE ] && [ "${fp:-0}" -ge 1 ]; then
    say "$1 ($S, $NAME): already set up: PIN yes, fingerprint count $fp"
    return 0
  fi
  if [ "$kg" = true ]; then
    if [ "$CRED" != NONE ]; then
      say "$1 ($S, $NAME): LOCKED (the keyguard shows). Skipped; run 'unlock $1' first, then 'setup $1' again"
      return 1
    fi
    adb -s "$S" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1
    adb -s "$S" shell wm dismiss-keyguard >/dev/null 2>&1
  fi
  case "$CRED" in
    NONE)
      adb -s "$S" shell locksettings set-pin "$PIN" >/dev/null 2>&1
      read_lock "$S"
      if [ -z "$CRED" ] || [ "$CRED" = NONE ]; then
        say "$1 ($S, $NAME): the PIN was NOT set (CredentialType ${CRED:-unreadable}). Nothing else done"
        return 1
      fi
      ;;
    PIN | PASSWORD_OR_PIN) ;; # a PIN from an earlier, unfinished run: go on with the enrolment
    *)
      say "$1 ($S, $NAME): has a lock of another kind ($CRED) that this helper did not set. Not touched"
      return 1
      ;;
  esac
  adb -s "$S" shell am start -a android.settings.BIOMETRIC_ENROLL >/dev/null 2>&1
  sleep "$PAUSE"
  adb -s "$S" shell input text "$PIN" >/dev/null 2>&1
  adb -s "$S" shell input keyevent 66 >/dev/null 2>&1
  sleep "$PAUSE"
  n=0
  while [ "$n" -lt "$TAPS" ]; do
    adb -s "$S" shell input tap "$(tap_x "$1")" "$(tap_y "$1")" >/dev/null 2>&1
    sleep "$PAUSE"
    n=$((n + 1))
  done
  r=0
  fp=0
  while [ "$r" -lt "$ROUNDS" ]; do
    r=$((r + 1))
    adb -s "$S" emu finger touch 1 >/dev/null 2>&1
    sleep 1
    adb -s "$S" emu finger remove 1 >/dev/null 2>&1
    sleep 1
    fp=$(fingerprint_count "$S")
    [ "${fp:-0}" -ge 1 ] && break
  done
  adb -s "$S" shell input keyevent KEYCODE_HOME >/dev/null 2>&1
  say "$1 ($S, $NAME): set up: PIN yes, fingerprint count ${fp:-0} ($r sensor touches)"
  if [ "${fp:-0}" -lt 1 ]; then
    manual_steps "$1"
    return 1
  fi
  return 0
}

unlock_device() { # $1 = target. 0 = not locked (now or before); 1 = still locked; 69 = unavailable
  open_device "$1" || return $?
  kg=$(keyguard_showing "$S")
  if [ "$kg" != true ]; then
    say "$1 ($S, $NAME): not locked (isKeyguardShowing=${kg:-unreadable}); nothing to do"
    return 0
  fi
  read_lock "$S"
  case "$CRED" in
    NONE | PIN | PASSWORD_OR_PIN) ;;
    '')
      say "$1 ($S, $NAME): the lock state cannot be read (dumpsys lock_settings). Nothing done"
      return 69
      ;;
    *)
      say "$1 ($S, $NAME): has a lock of another kind ($CRED) that this helper did not set. Not touched"
      return 1
      ;;
  esac
  adb -s "$S" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1
  # A keyguard without a credential goes away here; a PIN lock shows its PIN pad.
  adb -s "$S" shell wm dismiss-keyguard >/dev/null 2>&1
  if [ "$CRED" != NONE ]; then
    sleep "$PAUSE"
    adb -s "$S" shell input text "$PIN" >/dev/null 2>&1
    adb -s "$S" shell input keyevent 66 >/dev/null 2>&1
  fi
  n=0
  while kg=$(keyguard_showing "$S") && [ "$kg" = true ] && [ "$n" -lt 10 ]; do
    sleep 1
    n=$((n + 1))
  done
  if [ "$kg" = false ]; then
    say "$1 ($S, $NAME): unlocked (isKeyguardShowing=false)"
    return 0
  fi
  say "$1 ($S, $NAME): STILL LOCKED (isKeyguardShowing=${kg:-unreadable}). One attempt was made and no more. Wrong PIN (DEMS_EMULATOR_PIN)? Or unlock it in the emulator window"
  return 1
}

remove_device() { # $1 = target. 0 = no lock (now or before); 1 = not removed; 69 = unavailable
  open_device "$1" || return $?
  read_lock "$S"
  fp=$(fingerprint_count "$S")
  if [ -z "$CRED" ]; then
    say "$1 ($S, $NAME): the lock state cannot be read (dumpsys lock_settings). Nothing done"
    return 69
  fi
  if [ "$CRED" = NONE ]; then
    say "$1 ($S, $NAME): no lock set; nothing to remove (fingerprint count ${fp:-0})"
    return 0
  fi
  if [ "$(keyguard_showing "$S")" = true ]; then
    say "$1 ($S, $NAME): LOCKED (the keyguard shows). Skipped; run 'unlock $1' first, then 'remove $1' again"
    return 1
  fi
  adb -s "$S" shell locksettings clear --old "$PIN" >/dev/null 2>&1
  read_lock "$S"
  fp=$(fingerprint_count "$S")
  if [ "$CRED" = NONE ]; then
    say "$1 ($S, $NAME): lock removed: CredentialType NONE, fingerprint count ${fp:-0}"
    return 0
  fi
  say "$1 ($S, $NAME): NOT removed (CredentialType ${CRED:-unreadable}). One attempt was made and no more. Wrong PIN (DEMS_EMULATOR_PIN)?"
  return 1
}

# ---- locking and dispatch ------------------------------------------------------------------------
# Runs this script again for ONE device, holding that device's lock: the same .locks/dems_<target>.lock
# device-session.sh holds, so the action waits for a running session and no session starts during it.
run_locked() { # $1 = action, $2 = target
  /usr/bin/lockf -k -t "$LOCK_WAIT_S" "$LOCKS/dems_$2.lock" /bin/sh "$SELF" __locked "$1" "$2"
  lst=$?
  [ "$lst" -ne 75 ] || say "$2: the device lock .locks/dems_$2.lock stayed busy for $LOCK_WAIT_S s (a device session is running). Nothing done; try again, or raise LOCK_WAIT"
  return "$lst"
}

worse() { # $1 = status so far, $2 = a device's status: 69 wins over 75, 75 over any other failure
  if [ "$2" -eq 0 ]; then
    echo "$1"
    return
  fi
  case "$1" in
    69) echo 69 ;;
    75) if [ "$2" -eq 69 ]; then echo 69; else echo 75; fi ;;
    0) echo "$2" ;;
    *) case "$2" in 69 | 75) echo "$2" ;; *) echo "$1" ;; esac ;;
  esac
}

main() {
  inner=0
  if [ "${1:-}" = __locked ]; then # the call run_locked makes, lock held
    inner=1
    shift
  fi
  if [ $# -lt 1 ] || [ $# -gt 2 ]; then usage; fi
  action=$1
  target=${2:-all}
  case "$action" in status | setup | unlock | remove) ;; *) usage ;; esac
  case "$target" in
    phone | phone2 | tablet) targets=$target ;;
    all)
      [ "$inner" -eq 0 ] || usage
      targets="phone phone2 tablet"
      ;;
    *) usage ;;
  esac
  check_config
  rc=0
  if [ "$action" = status ]; then
    for t in $targets; do
      status_device "$t"
      rc=$(worse "$rc" $?)
    done
    exit "$rc"
  fi
  require_user_terminal "$action"
  if [ "$inner" -eq 1 ]; then
    "${action}_device" "$target"
    exit $?
  fi
  init_paths
  mkdir -p "$LOCKS"
  for t in $targets; do
    run_locked "$action" "$t"
    rc=$(worse "$rc" $?)
  done
  exit "$rc"
}

if [ "${DEMS_USER_LOCK_LIB:-0}" = 1 ]; then
  return 0 2>/dev/null || exit 0
fi
main "$@"
