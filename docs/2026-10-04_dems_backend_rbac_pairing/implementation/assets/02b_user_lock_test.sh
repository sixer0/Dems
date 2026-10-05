#!/bin/sh
# W02b follow-up, part B: stub tests of apps/mobile/scripts/emulator-user-lock.sh.
# NO DEVICE IS TOUCHED: `adb` is a stub that records every call and keeps a small model of the lock
# state in files; `sleep` is a stub too (it records the pause and returns at once). The script's
# action functions are reached by sourcing a scratch copy in library mode (DEMS_USER_LOCK_LIB=1),
# never by getting past its terminal check; the terminal check itself is tested by executing it.
#   usage: sh 02b_user_lock_test.sh <path of emulator-user-lock.sh> <work dir>
# The PIN used by the cases is this harness's own value. The script's default is read from the
# script at run time and is masked as <PIN> in everything printed here.
set -u
SCRIPT=$1
W=$2
rm -rf "$W"
mkdir -p "$W/sdk/platform-tools" "$W/sdk/emulator" "$W/root/apps/mobile/scripts" "$W/root/.locks" "$W/cases"
COPY="$W/root/apps/mobile/scripts/emulator-user-lock.sh"
cp "$SCRIPT" "$COPY"
chmod +x "$COPY"
TESTPIN=24681357
DEFPIN=$(sed -n 's/^PIN="\${DEMS_EMULATOR_PIN:-\([0-9]*\)}"$/\1/p' "$SCRIPT")
PASSED=0
FAILED=0
CASE_PREFIX=""

cat >"$W/sdk/platform-tools/adb" <<'EOF'
#!/bin/sh
# stub adb: records the call; models one emulator per serial from files in $STUB_STATE:
#   up, avdname, keyguard (true|false), cred (NONE|PIN|PATTERN), fp (count), pin (the PIN the device
#   holds), fp_after (sensor touches the enrolment needs; absent: it never completes), setpin_fails.
# The enrolment model follows the documented procedure: BIOMETRIC_ENROLL started, the right PIN and
# ENTER, at least two taps (MORE, I AGREE), then sensor touches. Out of order, nothing is enrolled.
echo "adb $*" >>"$STUB_TRACE"
[ "${1:-}" = "-s" ] && { ser=$2; shift 2; } || ser=none
get() { cat "$STUB_STATE/$1.$ser" 2>/dev/null; }
put() { echo "$2" >"$STUB_STATE/$1.$ser"; }
all="$*"
case "$all" in
  get-state) [ -f "$STUB_STATE/up.$ser" ] && echo device || { echo "error: device '$ser' not found" >&2; exit 1; } ;;
  "shell getprop sys.boot_completed") echo 1 ;;
  "emu avd name") printf '%s\r\nOK\r\n' "$(get avdname)" ;;
  "shell dumpsys window") printf '  mCurrentFocus=Window{stub}\r\n  isKeyguardShowing=%s\r\n' "$(get keyguard)" ;;
  "shell dumpsys lock_settings")
    [ -f "$STUB_STATE/lockstate_unreadable.$ser" ] && exit 0
    c=$(get cred)
    d=false
    [ "$c" = NONE ] && d=true
    printf 'Current lock settings service state:\r\n\r\nUser State:\r\n  User 0\r\n    Quality: 0\r\n    CredentialType: %s\r\n    IsLockScreenDisabled: %s\r\n' "$c" "$d"
    ;;
  "shell dumpsys fingerprint") printf 'Dumping for sensorId: 0, provider: FingerprintProvider\r\n{"service":"FingerprintProvider\\/default","prints":[{"id":0,"count":%s,"accept":0}]}\r\n' "$(get fp)" ;;
  "shell locksettings set-pin "*)
    if [ -f "$STUB_STATE/setpin_fails.$ser" ]; then echo "Error while executing command: set-pin"; else
      put cred PIN
      put pin "${all#shell locksettings set-pin }"
      echo "Pin set"
    fi
    ;;
  "shell locksettings clear --old "*)
    if [ "${all#shell locksettings clear --old }" = "$(get pin)" ]; then
      put cred NONE
      put fp 0
      echo "Lock credential cleared"
    else echo "Old password didn't match"; fi
    ;;
  "shell am start -a android.settings.BIOMETRIC_ENROLL")
    put enrol started
    put taps 0
    put touches 0
    echo "Starting: Intent { act=android.settings.BIOMETRIC_ENROLL }"
    ;;
  "shell input text "*) put typed "${all#shell input text }" ;;
  "shell input keyevent 66")
    if [ "$(get typed)" = "$(get pin)" ]; then
      if [ "$(get enrol)" = started ]; then put enrol confirmed; elif [ "$(get keyguard)" = true ]; then put keyguard false; fi
    fi
    put typed ""
    ;;
  "shell input tap "*) [ "$(get enrol)" = confirmed ] && put taps $(($(get taps) + 1)) ;;
  "emu finger touch 1")
    if [ "$(get enrol)" = confirmed ] && [ "$(get taps)" -ge 2 ]; then
      t=$(($(get touches) + 1))
      put touches "$t"
      need=$(get fp_after)
      [ -n "$need" ] && [ "$t" -ge "$need" ] && put fp 1
    fi
    ;;
  "shell wm dismiss-keyguard") [ "$(get cred)" = NONE ] && put keyguard false ;;
  "shell input keyevent KEYCODE_HOME") put enrol "" ;;
esac
exit 0
EOF
cat >"$W/sdk/platform-tools/sleep" <<'EOF'
#!/bin/sh
# stub sleep: records the pause, does not wait
echo "sleep $*" >>"$STUB_TRACE"
exit 0
EOF
chmod +x "$W/sdk/platform-tools/adb" "$W/sdk/platform-tools/sleep"

newcase() { # $1 = label
  L=$1
  ST="$W/cases/$L/state"
  mkdir -p "$ST"
  : >"$W/cases/$L/trace"
  PINV=$TESTPIN
}
dev() { # serial, avd name, keyguard, cred, fingerprints, PIN held by the device ('' none), touches needed ('' never)
  : >"$ST/up.$1"
  echo "$2" >"$ST/avdname.$1"
  echo "$3" >"$ST/keyguard.$1"
  echo "$4" >"$ST/cred.$1"
  echo "$5" >"$ST/fp.$1"
  [ -n "$6" ] && echo "$6" >"$ST/pin.$1"
  [ -n "$7" ] && echo "$7" >"$ST/fp_after.$1"
  return 0
}
# lib <PIN or ''> <function> <args...>: the function of the script, called in library mode, stub adb on PATH
lib() {
  PINV=${1:-$DEFPIN}
  lp=$1
  shift
  (
    export STUB_TRACE="$W/cases/$L/trace" STUB_STATE="$ST" ANDROID_HOME="$W/sdk" DEMS_USER_LOCK_LIB=1
    unset DEMS_AVD_PREFIX LOCK_WAIT DEMS_EMULATOR_PIN
    [ -z "$lp" ] || export DEMS_EMULATOR_PIN="$lp"
    [ -z "${CASE_PREFIX:-}" ] || export DEMS_AVD_PREFIX="$CASE_PREFIX"
    . "$COPY"
    [ "$(command -v adb)" = "$W/sdk/platform-tools/adb" ] || { echo "HARNESS ERROR: adb is not the stub"; exit 99; }
    check_config
    "$@"
  ) >>"$W/cases/$L/out" 2>&1 </dev/null
  echo $? >"$W/cases/$L/status"
}
# run <env assignments...> -- <args...>: the script EXECUTED (its main), stub adb, no terminal on stdin
run() {
  envs=""
  while [ "$1" != "--" ]; do
    envs="$envs $1"
    shift
  done
  shift
  # shellcheck disable=SC2086
  env -i HOME="$HOME" PATH="/usr/bin:/bin:/usr/sbin:/sbin" ANDROID_HOME="$W/sdk" STUB_TRACE="$W/cases/$L/trace" STUB_STATE="$ST" $envs \
    /bin/sh "$COPY" "$@" >>"$W/cases/$L/out" 2>&1 </dev/null
  echo $? >"$W/cases/$L/status"
}
masked() { sed -e "s/$PINV/<PIN>/g" -e "s#$W/root/#<root>/#g" -e "s#$W#<work>#g" "$1"; }
ok() { # $1 = text
  PASSED=$((PASSED + 1))
  echo "  PASS  $1"
}
bad() {
  FAILED=$((FAILED + 1))
  echo "  FAIL  $1"
}
want_status() { if [ "$(cat "$W/cases/$L/status")" = "$1" ]; then ok "exit status $1"; else bad "exit status $(cat "$W/cases/$L/status"), wanted $1"; fi; }
want_trace() { # stdin = the exact call sequence wanted (PIN masked)
  cat >"$W/cases/$L/want"
  masked "$W/cases/$L/trace" >"$W/cases/$L/trace.masked"
  if cmp -s "$W/cases/$L/want" "$W/cases/$L/trace.masked"; then ok "exact adb call sequence ($(grep -c '^adb' "$W/cases/$L/trace.masked") adb calls)"; else
    bad "adb call sequence differs:"
    diff "$W/cases/$L/want" "$W/cases/$L/trace.masked" | sed 's/^/        /'
  fi
}
want_no_calls() { if [ -s "$W/cases/$L/trace" ]; then bad "calls were made: $(wc -l <"$W/cases/$L/trace" | tr -d ' ')"; else ok "nothing was sent to adb (the stub's call log is empty)"; fi; }
want_out() { if masked "$W/cases/$L/out" | grep -q -- "$1"; then ok "output has: $1"; else bad "output lacks: $1"; fi; }
want_no_writes() { # no call that changes a device
  if grep -E 'locksettings|input |emu finger|wm dismiss|am start|install|reverse' "$W/cases/$L/trace" >/dev/null; then bad "a device-changing call was made"; else ok "read-only calls only"; fi
}
want_no_pin_in_output() { if grep -q -e "$PINV" "$W/cases/$L/out"; then bad "the PIN appears in the script's output"; else ok "the script's output does not contain the PIN"; fi; }
show() {
  echo "  -- output"
  masked "$W/cases/$L/out" | sed 's/^/     /'
}
showtrace() {
  echo "  -- stub call log (PIN masked)"
  masked "$W/cases/$L/trace" | sed 's/^/     /'
}
reads() { # the opening reads of an action on $1
  echo "adb -s $1 get-state"
  echo "adb -s $1 shell getprop sys.boot_completed"
  echo "adb -s $1 emu avd name"
}
enrol_seq() { # serial, x, y, rounds: BIOMETRIC_ENROLL .. HOME
  echo "adb -s $1 shell am start -a android.settings.BIOMETRIC_ENROLL"
  echo "sleep 2"
  echo "adb -s $1 shell input text <PIN>"
  echo "adb -s $1 shell input keyevent 66"
  echo "sleep 2"
  for i in 1 2 3; do
    echo "adb -s $1 shell input tap $2 $3"
    echo "sleep 2"
  done
  i=0
  while [ "$i" -lt "$4" ]; do
    echo "adb -s $1 emu finger touch 1"
    echo "sleep 1"
    echo "adb -s $1 emu finger remove 1"
    echo "sleep 1"
    echo "adb -s $1 shell dumpsys fingerprint"
    i=$((i + 1))
  done
  echo "adb -s $1 shell input keyevent KEYCODE_HOME"
}

echo "== emulator-user-lock.sh stub tests $(date '+%Y-%m-%d %H:%M:%S')"
echo "script sha256: $(shasum -a 256 "$SCRIPT" | cut -d' ' -f1)"
echo "shell: /bin/sh; stdin of this harness is a terminal: $([ -t 0 ] && echo yes || echo no); stdout: $([ -t 1 ] && echo yes || echo no)"
case "$DEFPIN" in
  [0-9][0-9][0-9][0-9]) echo "default PIN of the script: read from the script, 4 digits, masked below" ;;
  *) echo "HARNESS ERROR: cannot read the default PIN line of the script"; exit 99 ;;
esac
echo

echo "A. The terminal check (the script EXECUTED, no terminal): setup, unlock, remove refuse with 77 before any adb call"
for a in "setup" "unlock" "remove" "setup phone" "unlock tablet" "remove all" "__locked setup phone" "__locked unlock phone2" "__locked remove tablet"; do
  newcase "tty_$(echo "$a" | tr ' ' '_')"
  dev emulator-5554 dems2_phone false NONE 0 "" 3
  dev emulator-5556 dems2_tablet false NONE 0 "" 3
  dev emulator-5558 dems2_phone2 false NONE 0 "" 3
  # shellcheck disable=SC2086
  run -- $a
  echo " $a"
  want_status 77
  want_no_calls
  want_out "this action is the user's; run it in your own Terminal"
done
newcase tty_message
dev emulator-5554 dems2_phone false NONE 0 "" 3
run -- setup phone
show
newcase lib_executed
dev emulator-5554 dems2_phone false NONE 0 "" 3
run DEMS_USER_LOCK_LIB=1 -- setup phone
echo " DEMS_USER_LOCK_LIB=1 with the script EXECUTED (not sourced): it must do nothing"
want_status 0
want_no_calls
if [ -s "$W/cases/$L/out" ]; then bad "it printed something"; else ok "no output"; fi
echo

echo "B. Usage and bad values (exit 64, before any adb call)"
for a in "" "bogus" "setup nosuch" "status phone extra" "__locked setup all"; do
  newcase "usage_$(echo "${a:-none}" | tr ' ' '_')"
  # shellcheck disable=SC2086
  run -- $a
  echo " args: [${a}]"
  want_status 64
  want_no_calls
done
for e in "DEMS_EMULATOR_PIN=12ab" "DEMS_EMULATOR_PIN=123" "DEMS_EMULATOR_PIN=123456789" "DEMS_AVD_PREFIX=dems-;x" "LOCK_WAIT=soon"; do
  newcase "bad_$(echo "$e" | tr -c 'A-Za-z0-9\n' '_')"
  run "$e" -- status
  echo " $e status"
  want_status 64
  want_no_calls
done
newcase bad_pin_message
run DEMS_EMULATOR_PIN=12ab -- status
show
if grep -q 12ab "$W/cases/$L/out"; then bad "the bad PIN value is echoed"; else ok "the bad PIN value is not echoed"; fi
echo

echo "C. status (the script EXECUTED, any caller): three devices, read-only"
newcase status_all
dev emulator-5554 dems2_phone false PIN 1 "$TESTPIN" ""
dev emulator-5556 dems2_tablet true PIN 1 "$TESTPIN" ""
run -- status
want_status 69
want_no_writes
show
showtrace
newcase status_foreign
dev emulator-5554 dems_phone true PIN 1 1111 ""
run -- status phone
want_status 0
want_no_writes
want_out "not dems2_phone: another AVD holds this port"
show
echo

echo "D. setup on a phone (no lock, no fingerprint; the enrolment needs 3 touches)"
newcase setup_phone
dev emulator-5554 dems2_phone false NONE 0 "" 3
lib "$TESTPIN" setup_device phone
want_status 0
{
  reads emulator-5554
  echo "adb -s emulator-5554 shell dumpsys lock_settings"
  echo "adb -s emulator-5554 shell dumpsys fingerprint"
  echo "adb -s emulator-5554 shell dumpsys window"
  echo "adb -s emulator-5554 shell locksettings set-pin <PIN>"
  echo "adb -s emulator-5554 shell dumpsys lock_settings"
  enrol_seq emulator-5554 911 2266 3
} | want_trace
want_out "phone (emulator-5554, dems2_phone): set up: PIN yes, fingerprint count 1"
want_no_pin_in_output
show
showtrace
echo " setup again on the same device (idempotence)"
: >"$W/cases/$L/trace"
: >"$W/cases/$L/out"
lib "$TESTPIN" setup_device phone
want_status 0
{
  reads emulator-5554
  echo "adb -s emulator-5554 shell dumpsys lock_settings"
  echo "adb -s emulator-5554 shell dumpsys fingerprint"
  echo "adb -s emulator-5554 shell dumpsys window"
} | want_trace
want_out "already set up: PIN yes, fingerprint count 1"
want_no_writes
show
echo

echo "E. setup on the tablet (tap position 1776 1280) and on phone2 (911 2266)"
newcase setup_tablet
dev emulator-5556 dems2_tablet false NONE 0 "" 3
lib "$TESTPIN" setup_device tablet
want_status 0
{
  reads emulator-5556
  echo "adb -s emulator-5556 shell dumpsys lock_settings"
  echo "adb -s emulator-5556 shell dumpsys fingerprint"
  echo "adb -s emulator-5556 shell dumpsys window"
  echo "adb -s emulator-5556 shell locksettings set-pin <PIN>"
  echo "adb -s emulator-5556 shell dumpsys lock_settings"
  enrol_seq emulator-5556 1776 1280 3
} | want_trace
want_out "tablet (emulator-5556, dems2_tablet): set up: PIN yes, fingerprint count 1"
show
newcase setup_phone2
dev emulator-5558 dems2_phone2 false NONE 0 "" 3
lib "$TESTPIN" setup_device phone2
want_status 0
{
  reads emulator-5558
  echo "adb -s emulator-5558 shell dumpsys lock_settings"
  echo "adb -s emulator-5558 shell dumpsys fingerprint"
  echo "adb -s emulator-5558 shell dumpsys window"
  echo "adb -s emulator-5558 shell locksettings set-pin <PIN>"
  echo "adb -s emulator-5558 shell dumpsys lock_settings"
  enrol_seq emulator-5558 911 2266 3
} | want_trace
want_out "phone2 (emulator-5558, dems2_phone2): set up: PIN yes, fingerprint count 1"
echo

echo "F. setup with the script's default PIN (DEMS_EMULATOR_PIN unset)"
newcase setup_default_pin
dev emulator-5554 dems2_phone false NONE 0 "" 3
lib "" setup_device phone
want_status 0
if [ "$(cat "$ST/pin.emulator-5554")" = "$DEFPIN" ]; then ok "the PIN the device received is the script's default"; else bad "the device did not receive the default PIN"; fi
want_no_pin_in_output
echo

echo "G. setup: the skips and refusals"
newcase setup_already
dev emulator-5554 dems2_phone false PIN 1 "$TESTPIN" ""
lib "$TESTPIN" setup_device phone
echo " already set up (credential and fingerprint exist)"
want_status 0
want_no_writes
want_out "already set up: PIN yes, fingerprint count 1"
newcase setup_locked
dev emulator-5554 dems2_phone true PIN 0 "$TESTPIN" 3
lib "$TESTPIN" setup_device phone
echo " LOCKED at the start (keyguard shows, credential set)"
want_status 1
want_no_writes
want_out "LOCKED (the keyguard shows). Skipped; run 'unlock phone' first"
show
newcase setup_foreign
dev emulator-5554 dems_phone false NONE 0 "" 3
lib "$TESTPIN" setup_device phone
echo " another AVD on the port (dems_phone on emulator-5554, prefix dems2_)"
want_status 69
reads emulator-5554 | want_trace
want_out "REFUSED. The emulator on this port is 'dems_phone', not dems2_phone"
show
newcase setup_foreign_prefix_given
dev emulator-5554 dems2_phone false NONE 0 "" 3
CASE_PREFIX=dems_
lib "$TESTPIN" setup_device phone
CASE_PREFIX=""
echo " DEMS_AVD_PREFIX=dems_ while dems2_phone runs on the port"
want_status 69
reads emulator-5554 | want_trace
want_out "REFUSED. The emulator on this port is 'dems2_phone', not dems_phone"
newcase setup_down
lib "$TESTPIN" setup_device phone
echo " device not running"
want_status 69
echo "adb -s emulator-5554 get-state" | want_trace
want_out "not running, or not booted yet. Nothing done"
newcase setup_other_lock
dev emulator-5554 dems2_phone false PATTERN 0 "" 3
lib "$TESTPIN" setup_device phone
echo " a lock of another kind (PATTERN)"
want_status 1
want_no_writes
want_out "has a lock of another kind (PATTERN)"
newcase setup_unreadable
dev emulator-5554 dems2_phone false NONE 0 "" 3
: >"$ST/lockstate_unreadable.emulator-5554"
lib "$TESTPIN" setup_device phone
echo " lock state unreadable"
want_status 69
want_no_writes
newcase setup_setpin_fails
dev emulator-5554 dems2_phone false NONE 0 "" 3
: >"$ST/setpin_fails.emulator-5554"
lib "$TESTPIN" setup_device phone
echo " set-pin fails"
want_status 1
want_out "the PIN was NOT set (CredentialType NONE). Nothing else done"
if grep -q BIOMETRIC_ENROLL "$W/cases/$L/trace"; then bad "the enrolment was started anyway"; else ok "no enrolment step followed"; fi
newcase setup_partial
dev emulator-5554 dems2_phone false PIN 0 "$TESTPIN" 3
lib "$TESTPIN" setup_device phone
echo " a PIN from an earlier, unfinished run (credential PIN, no fingerprint)"
want_status 0
{
  reads emulator-5554
  echo "adb -s emulator-5554 shell dumpsys lock_settings"
  echo "adb -s emulator-5554 shell dumpsys fingerprint"
  echo "adb -s emulator-5554 shell dumpsys window"
  enrol_seq emulator-5554 911 2266 3
} | want_trace
echo

echo "H. setup: the bounded loop (the enrolment never completes)"
newcase setup_bounded
dev emulator-5554 dems2_phone false NONE 0 "" ""
lib "$TESTPIN" setup_device phone
want_status 1
{
  reads emulator-5554
  echo "adb -s emulator-5554 shell dumpsys lock_settings"
  echo "adb -s emulator-5554 shell dumpsys fingerprint"
  echo "adb -s emulator-5554 shell dumpsys window"
  echo "adb -s emulator-5554 shell locksettings set-pin <PIN>"
  echo "adb -s emulator-5554 shell dumpsys lock_settings"
  enrol_seq emulator-5554 911 2266 8
} | want_trace
if [ "$(grep -c 'emu finger touch 1' "$W/cases/$L/trace")" = 8 ]; then ok "exactly 8 sensor touches, then it stops"; else bad "sensor touches: $(grep -c 'emu finger touch 1' "$W/cases/$L/trace")"; fi
want_out "set up: PIN yes, fingerprint count 0"
want_out "To finish by hand, in the window of that emulator"
want_no_pin_in_output
show
echo

echo "I. unlock"
newcase unlock_ok
dev emulator-5554 dems2_phone true PIN 1 "$TESTPIN" ""
lib "$TESTPIN" unlock_device phone
echo " locked, right PIN"
want_status 0
{
  reads emulator-5554
  echo "adb -s emulator-5554 shell dumpsys window"
  echo "adb -s emulator-5554 shell dumpsys lock_settings"
  echo "adb -s emulator-5554 shell input keyevent KEYCODE_WAKEUP"
  echo "adb -s emulator-5554 shell wm dismiss-keyguard"
  echo "sleep 2"
  echo "adb -s emulator-5554 shell input text <PIN>"
  echo "adb -s emulator-5554 shell input keyevent 66"
  echo "adb -s emulator-5554 shell dumpsys window"
} | want_trace
want_out "phone (emulator-5554, dems2_phone): unlocked (isKeyguardShowing=false)"
want_no_pin_in_output
show
newcase unlock_wrong_pin
dev emulator-5554 dems2_phone true PIN 1 13572468 ""
lib "$TESTPIN" unlock_device phone
echo " locked, the device holds another PIN"
want_status 1
if [ "$(grep -c 'input text' "$W/cases/$L/trace")" = 1 ]; then ok "exactly one PIN attempt"; else bad "PIN attempts: $(grep -c 'input text' "$W/cases/$L/trace")"; fi
want_out "STILL LOCKED (isKeyguardShowing=true). One attempt was made and no more"
newcase unlock_not_locked
dev emulator-5554 dems2_phone false PIN 1 "$TESTPIN" ""
lib "$TESTPIN" unlock_device phone
echo " not locked"
want_status 0
want_no_writes
want_out "not locked (isKeyguardShowing=false); nothing to do"
newcase unlock_no_credential
dev emulator-5554 dems2_phone true NONE 0 "" ""
lib "$TESTPIN" unlock_device phone
echo " a keyguard without a credential: dismissed, no PIN typed"
want_status 0
if grep -q 'input text' "$W/cases/$L/trace"; then bad "a PIN was typed"; else ok "no PIN typed"; fi
newcase unlock_foreign
dev emulator-5554 dems_phone true PIN 1 1111 ""
lib "$TESTPIN" unlock_device phone
echo " another AVD on the port"
want_status 69
reads emulator-5554 | want_trace
echo

echo "J. remove"
newcase remove_ok
dev emulator-5554 dems2_phone false PIN 1 "$TESTPIN" ""
lib "$TESTPIN" remove_device phone
echo " lock and fingerprint present, right PIN"
want_status 0
{
  reads emulator-5554
  echo "adb -s emulator-5554 shell dumpsys lock_settings"
  echo "adb -s emulator-5554 shell dumpsys fingerprint"
  echo "adb -s emulator-5554 shell dumpsys window"
  echo "adb -s emulator-5554 shell locksettings clear --old <PIN>"
  echo "adb -s emulator-5554 shell dumpsys lock_settings"
  echo "adb -s emulator-5554 shell dumpsys fingerprint"
} | want_trace
want_out "phone (emulator-5554, dems2_phone): lock removed: CredentialType NONE, fingerprint count 0"
want_no_pin_in_output
show
newcase remove_none
dev emulator-5554 dems2_phone false NONE 0 "" ""
lib "$TESTPIN" remove_device phone
echo " no lock set"
want_status 0
want_no_writes
want_out "no lock set; nothing to remove"
newcase remove_wrong_pin
dev emulator-5554 dems2_phone false PIN 1 13572468 ""
lib "$TESTPIN" remove_device phone
echo " the device holds another PIN"
want_status 1
if [ "$(grep -c 'locksettings clear' "$W/cases/$L/trace")" = 1 ]; then ok "exactly one attempt"; else bad "attempts: $(grep -c 'locksettings clear' "$W/cases/$L/trace")"; fi
want_out "NOT removed (CredentialType PIN). One attempt was made and no more"
newcase remove_locked
dev emulator-5554 dems2_phone true PIN 1 "$TESTPIN" ""
lib "$TESTPIN" remove_device phone
echo " LOCKED at the start"
want_status 1
want_no_writes
want_out "LOCKED (the keyguard shows). Skipped; run 'unlock phone' first"
newcase remove_foreign
dev emulator-5556 dems_tablet false PIN 1 1111 ""
lib "$TESTPIN" remove_device tablet
echo " another AVD on the port"
want_status 69
reads emulator-5556 | want_trace
echo

echo "K. the device lock: run_locked uses .locks/dems_<target>.lock and waits behind a holder"
newcase lock_wiring
dev emulator-5554 dems2_phone false NONE 0 "" 3
(
  export STUB_TRACE="$W/cases/$L/trace" STUB_STATE="$ST" ANDROID_HOME="$W/sdk" DEMS_USER_LOCK_LIB=1 DEMS_EMULATOR_PIN="$TESTPIN"
  . "$COPY"
  unset DEMS_USER_LOCK_LIB
  SELF="$COPY"
  LOCKS="$W/root/.locks"
  LOCK_WAIT_S=1
  /usr/bin/lockf -k "$LOCKS/dems_phone.lock" /bin/sleep 4 &
  holder=$!
  /bin/sleep 1
  run_locked setup phone </dev/null
  echo "run_locked while another process holds dems_phone.lock: status $?"
  wait "$holder"
  run_locked setup phone </dev/null
  echo "run_locked with the lock free: status $? (the locked inner call is reached; with no terminal it refuses)"
  ls "$LOCKS"
) >"$W/cases/$L/out" 2>&1
show
if grep -q 'holds dems_phone.lock: status 75' "$W/cases/$L/out"; then ok "busy lock: 75, and the action did not run"; else bad "busy lock did not give 75"; fi
if grep -q 'the lock free: status 77' "$W/cases/$L/out"; then ok "free lock: the inner call ran under the lock and stopped at the terminal check (77)"; else bad "free lock: inner call not reached"; fi
want_no_calls
echo

echo "== result: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
