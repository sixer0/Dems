#!/bin/bash
# Test of the host profile scripts, for the development machine (macOS or any non-Ubuntu host).
#
#   bash scripts/host/test_host_profile_scripts.sh
#
# What it shows: every script completes in print-only mode; together they name the 49 items of
# HOST-PROFILE-UBUNTU-24.04.md, each once, each with its class, its check and its confirm line
# (the document's seven database items HOST-50 to HOST-56 are printed as steps DB-01 to DB-07);
# no program is started in print-only mode (the scripts run with a PATH that holds ONLY recording
# doubles of the changing tools, so a started tool is either recorded or "command not found");
# --apply is refused off Ubuntu 24.04 and changes nothing; a value that is not of the closed
# form is refused; the apply branch of the two writing functions calls what it prints (against
# the doubles). What it does NOT show: anything about Ubuntu. No command of the profile is run.
#
# It writes only inside one temporary folder, which it removes at the end.
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
PROFILE="$HERE/HOST-PROFILE-UBUNTU-24.04.md"
LIB="$HERE/host-profile-lib.sh"
ITEM_SCRIPTS='10-preflight.sh 20-user-dirs.sh 30-runtime-media.sh 40-network-firewall.sh 50-audio.sh 60-sleep-time.sh 70-core-unit.sh 80-helper-state.sh 90-activation-final.sh'
ALL_SCRIPTS="$ITEM_SCRIPTS 95-database.sh"
APPLY_SCRIPTS='20-user-dirs.sh 30-runtime-media.sh 40-network-firewall.sh 50-audio.sh 60-sleep-time.sh 70-core-unit.sh'
EXPECTED_ITEMS=49
EXPECTED_MARKED=43
# The database items of the profile document, HOST-50 to HOST-56 (task 4 integration pass I-3, on the
# request of the scripts' row): the document holds 49 + 7 = 56 items. The seven are printed by
# 95-database.sh under its own names DB-01 to DB-07 and by no item script; they carry "to confirm
# on the host", not a 9A check.
EXPECTED_DATABASE_ITEMS=7
DATABASE_ITEM='HOST-5[0-6]'

RUN=$(mktemp -d "${TMPDIR:-/tmp}/dems-host-profile-test.XXXXXX")
trap 'rm -rf "$RUN"' EXIT
mkdir "$RUN/doubles" "$RUN/home" "$RUN/tmp" "$RUN/cwd" "$RUN/out" "$RUN/real"
LOG="$RUN/recorded.log"
: >"$LOG"

# The recording doubles: every tool a step of the profile names, and the usual file tools.
# mktemp has no double on purpose: print-only must not need it, and its absence then fails the run.
for tool in sudo apt-get apt dpkg snap useradd usermod groupadd userdel groupdel install cp mv rm ln \
  mkdir rmdir chmod chown chgrp touch tee dd systemctl ufw nft sysctl ldconfig netplan timedatectl \
  make sed awk cat grep psql initdb pg_ctl pg_ctlcluster createdb createuser npm node curl wget tar \
  ip arping getent id uname lsb_release python3 sh bash env; do
  printf '#!/bin/bash\nprintf '"'"'%%s %%s\\n'"'"' %s "$*" >>%s\nexit 0\n' "$tool" "$LOG" >"$RUN/doubles/$tool"
  chmod 0755 "$RUN/doubles/$tool"
done
# For part 6 only: a stand-in for mktemp that stays inside the folder of the run (the mktemp of
# macOS does not honour TMPDIR without a template).
printf '#!/bin/bash\nf=%s/tmp/staged.$$\n: >"$f"\nprintf '"'"'%%s\\n'"'"' "$f"\n' "$RUN" >"$RUN/real/mktemp"
chmod 0755 "$RUN/real/mktemp"

PASSED=0
FAILED=0
ok() {
  PASSED=$((PASSED + 1))
  printf 'ok      %s\n' "$1"
}
bad() {
  FAILED=$((FAILED + 1))
  printf 'NOT OK  %s\n' "$1"
}
expect() { # expect <description> <command>...
  local what=$1
  shift
  if "$@"; then ok "$what"; else bad "$what"; fi
}
log_lines() { wc -l <"$LOG" | tr -d ' '; }
empty_dir() { [ -z "$(ls -A "$1")" ]; }

# run_script <name of output> <script> <argument>...: restricted PATH, empty environment.
run_script() {
  local out=$1 script=$2 code=0
  shift 2
  (cd "$RUN/cwd" && /usr/bin/env -i PATH="$RUN/doubles" HOME="$RUN/home" TMPDIR="$RUN/tmp" \
    /bin/bash "$HERE/$script" "$@") >"$RUN/out/$out.txt" 2>"$RUN/out/$out.err" || code=$?
  printf '%s' "$code" >"$RUN/out/$out.code"
}
code_of() { cat "$RUN/out/$1.code"; }

manifest() { (cd "$HERE" && find . -type f ! -name '*.pyc' -print0 | sort -z | xargs -0 shasum -a 256); }
manifest >"$RUN/manifest.before"
if command -v git >/dev/null 2>&1; then git -C "$HERE" status --porcelain -- . >"$RUN/git.before" 2>/dev/null || :; fi

printf '%s\n' '--- 1. static'
for s in $ALL_SCRIPTS host-profile-lib.sh test_host_profile_scripts.sh; do
  expect "$s parses (bash -n)" /bin/bash -n "$HERE/$s"
  expect "$s starts with #!/bin/bash" [ "$(head -1 "$HERE/$s")" = '#!/bin/bash' ]
done
for s in $ALL_SCRIPTS; do
  expect "$s sets -eu" grep -q '^set -eu$' "$HERE/$s"
done
if grep -nE '(^|[;&|[:space:]])eval[[:space:]]' "$HERE"/[0-9]*.sh "$LIB" >"$RUN/out/eval.txt"; then
  bad 'no eval in the scripts'
else
  ok 'no eval in the scripts'
fi
# The only file a script reads as shell text is the shared file beside it.
if grep -hE '^[[:space:]]*(\.|source)[[:space:]]' "$HERE"/[0-9]*.sh "$LIB" | grep -vxF '. "$HP_DIR/host-profile-lib.sh"' >"$RUN/out/dot.txt"; then
  bad 'the only file read as shell text is host-profile-lib.sh'
else
  ok 'the only file read as shell text is host-profile-lib.sh'
fi
if grep -n 'os-release' "$LIB" | grep -vE '#|\[ -r /etc/os-release \]|done </etc/os-release|hp_fail' >"$RUN/out/osrel.txt"; then
  bad '/etc/os-release is only read as text'
else
  ok '/etc/os-release is only read as text'
fi

printf '%s\n' '--- 2. print-only is the default and completes'
for s in $ALL_SCRIPTS; do
  run_script "$s" "$s"
  expect "$s exits 0 without a flag" [ "$(code_of "$s")" = 0 ]
  expect "$s prints nothing on standard error" [ ! -s "$RUN/out/$s.err" ]
  expect "$s states the mode PRINT-ONLY" grep -q '^# mode: PRINT-ONLY' "$RUN/out/$s.txt"
  expect "$s states UNPROVEN ON LINUX" grep -q 'UNPROVEN ON LINUX' "$RUN/out/$s.txt"
  expect "$s ends with: commands run 0; files written 0" grep -q 'commands run 0; files written 0$' "$RUN/out/$s.txt"
done
expect 'programs started by the 10 print-only runs: 0 (recording log empty)' [ "$(log_lines)" = 0 ]

printf '%s\n' '--- 3. the items'
: >"$RUN/items.out"
for s in $ITEM_SCRIPTS; do cat "$RUN/out/$s.txt" >>"$RUN/items.out"; done
grep -oE '^\| HOST-[0-9]{2} \|' "$PROFILE" | tr -d '| ' | sort >"$RUN/ids.profile.all"
grep -vxE "$DATABASE_ITEM" "$RUN/ids.profile.all" >"$RUN/ids.profile"
grep -oE '^== HOST-[0-9]{2} ' "$RUN/items.out" | tr -d '= ' | sort >"$RUN/ids.scripts"
expect "the profile document holds $((EXPECTED_ITEMS + EXPECTED_DATABASE_ITEMS)) items: $EXPECTED_ITEMS and the $EXPECTED_DATABASE_ITEMS database items" \
  [ "$(wc -l <"$RUN/ids.profile.all" | tr -d ' ')" = "$((EXPECTED_ITEMS + EXPECTED_DATABASE_ITEMS))" ]
expect 'no item of the profile document is listed twice' [ -z "$(uniq -d "$RUN/ids.profile.all")" ]
expect "the database items of the profile are HOST-50 to HOST-56, each \"to confirm on the host\"" \
  [ "$(grep -E "^\| $DATABASE_ITEM \|" "$PROFILE" | grep -cE 'to confirm on the host[^|]*\|$')" = "$EXPECTED_DATABASE_ITEMS" ]
expect "the profile document holds $EXPECTED_ITEMS items beside them" [ "$(wc -l <"$RUN/ids.profile" | tr -d ' ')" = "$EXPECTED_ITEMS" ]
expect "the scripts name $EXPECTED_ITEMS items" [ "$(wc -l <"$RUN/ids.scripts" | tr -d ' ')" = "$EXPECTED_ITEMS" ]
expect 'no item is named twice' [ -z "$(uniq -d "$RUN/ids.scripts")" ]
expect 'the items of the scripts are exactly the items of the profile' cmp -s "$RUN/ids.profile" "$RUN/ids.scripts"

# Per item: one class, at least one check line, exactly one confirm line, and what its class needs.
awk '
  function flush() {
    if (id == "") return
    problem = ""
    if (class == "") problem = problem " no-class"
    if (checks < 1) problem = problem " no-check"
    if (confirms != 1) problem = problem " confirm-lines=" confirms
    if (class == "AUTO" && would < 1) problem = problem " auto-without-command"
    if (class == "MANUAL" && manual < 1) problem = problem " manual-without-text"
    if (class == "NONE" && why < 1) problem = problem " none-without-reason"
    if (class == "NONE" && would > 0) problem = problem " none-with-command"
    if (problem != "") print id ":" problem
    print id, class, marked > marks
  }
  /^== / { flush(); id = ""; class = ""; checks = 0; confirms = 0; would = 0; manual = 0; why = 0; marked = "plain" }
  /^== HOST-[0-9][0-9] / { id = $2 }
  id != "" && /^   class   : / { class = $3 }
  id != "" && /^   check   : / { checks++ }
  id != "" && /^   confirm : / { confirms++ }
  id != "" && /^   confirm : to confirm in .*9A\/H-[0-9][0-9]/ { marked = "marked" }
  id != "" && /^   would-(run|write)/ { would++ }
  id != "" && /^   (manual|file) +: / { manual++ }
  id != "" && /^   why     : / { why++ }
  END { flush() }
' marks="$RUN/marks.scripts.raw" "$RUN/items.out" >"$RUN/item.problems"
expect 'every item has a class, a check line, one confirm line and what its class needs' [ ! -s "$RUN/item.problems" ]
if [ -s "$RUN/item.problems" ]; then cat "$RUN/item.problems"; fi

# The "to confirm" marks agree with the profile document, item by item.
grep -E '^\| HOST-[0-9]{2} \|' "$PROFILE" | grep -vE "^\| $DATABASE_ITEM \|" | awk '
  { id = $2; if ($0 ~ /\| - \|$/) print id, "plain"; else if ($0 ~ /to confirm in 9A\/H-[0-9][0-9][^|]*\|$/) print id, "marked"; else print id, "unreadable" }
' | sort >"$RUN/marks.profile"
awk '{ print $1, $3 }' "$RUN/marks.scripts.raw" | sort >"$RUN/marks.scripts"
expect 'the "to confirm in 9A/H-nn" marks equal those of the profile, item by item' cmp -s "$RUN/marks.profile" "$RUN/marks.scripts"
expect "items marked \"to confirm in 9A/H-nn\": $EXPECTED_MARKED" [ "$(grep -c ' marked$' "$RUN/marks.scripts")" = "$EXPECTED_MARKED" ]
expect 'the 16 open points are printed, each with its check' [ "$(grep -c '^   open [ 0-9][0-9] : ' "$RUN/out/90-activation-final.sh.txt")" = 16 ]
expect 'the database steps DB-01 to DB-07 are printed, each to confirm on the host' \
  [ "$(grep -c 'to confirm on the host' "$RUN/out/95-database.sh.txt")" = 7 ]
expect 'the database steps printed are as many as the database items of the profile' \
  [ "$(grep -cE '^== DB-0[1-7] ' "$RUN/out/95-database.sh.txt")" = "$EXPECTED_DATABASE_ITEMS" ]
expect 'the database steps name loopback only' grep -q "listen_addresses = '127.0.0.1'" "$RUN/out/95-database.sh.txt"
expect 'the database steps name the database dems_demo' grep -q 'db:create -- --database dems_demo' "$RUN/out/95-database.sh.txt"
expect 'the database steps claim no item id of the profile' [ "$(grep -c '^== HOST-' "$RUN/out/95-database.sh.txt")" = 0 ]
expect 'the helper script names no command of its own (0 would-run lines)' \
  [ "$(grep -c '^   would-' "$RUN/out/80-helper-state.sh.txt")" = 0 ]

printf '%s\n' '--- 4. --apply is refused on this system and changes nothing'
os_is_ubuntu=0
if [ -r /etc/os-release ] && grep -q '^ID=ubuntu$' /etc/os-release && grep -q '^VERSION_ID="24.04"$' /etc/os-release; then os_is_ubuntu=1; fi
if [ "$os_is_ubuntu" = 1 ]; then
  printf 'SKIPPED this system is Ubuntu 24.04: the refusal off Ubuntu cannot be shown here, and --apply is not tried by a test\n'
else
  for s in $ALL_SCRIPTS; do
    run_script "apply.$s" "$s" --apply --service-user dems-core --install-dir /opt/dems/core --data-dir /srv/dems/data \
      --ffmpeg-prefix /opt/dems/ffmpeg-9.0.2 --camera-interface enp3s0 --camera-address 192.168.50.1 --with-lid
    want=2
    case " $APPLY_SCRIPTS " in *" $s "*) want=3 ;; esac
    expect "$s --apply is refused with exit code $want" [ "$(code_of "apply.$s")" = "$want" ]
    expect "$s --apply prints no step" [ ! -s "$RUN/out/apply.$s.txt" ]
    expect "$s --apply says that nothing was changed" grep -q 'Nothing was changed' "$RUN/out/apply.$s.err"
  done
  expect 'programs started by the 10 refused --apply runs: 0' [ "$(log_lines)" = 0 ]
fi

printf '%s\n' '--- 5. values: closed forms only, never evaluated'
n=0
refuse() { # refuse <script> <argument>...
  n=$((n + 1))
  run_script "refuse.$n" "$@"
  expect "refused with exit code 2, no step printed: $*" refused_cleanly "refuse.$n"
}
refused_cleanly() { [ "$(code_of "$1")" = 2 ] && [ ! -s "$RUN/out/$1.txt" ] && [ -s "$RUN/out/$1.err" ]; }
refuse 20-user-dirs.sh --service-user 'a;b'
refuse 20-user-dirs.sh --service-user '$(touch planted)'
refuse 20-user-dirs.sh --service-user root
refuse 20-user-dirs.sh --service-user dems
refuse 20-user-dirs.sh --service-user
refuse 20-user-dirs.sh --data-dir relative/path
refuse 20-user-dirs.sh --data-dir /srv/../etc
refuse 20-user-dirs.sh --data-dir '/srv/dems data'
refuse 20-user-dirs.sh --install-dir '/opt/`touch planted`'
refuse 30-runtime-media.sh --ffmpeg-prefix /opt/dems/
refuse 40-network-firewall.sh --camera-interface 'eth0;reboot'
refuse 40-network-firewall.sh --camera-interface lo
refuse 40-network-firewall.sh --camera-address 8.8.8.8
refuse 40-network-firewall.sh --camera-address 10.0.0.0
refuse 40-network-firewall.sh --camera-address 10.0.0.1/24
refuse 40-network-firewall.sh --camera-address 192.168.1.999
refuse 10-preflight.sh --no-such-option
expect 'no file was planted by a refused value' empty_dir "$RUN/cwd"

run_script values 40-network-firewall.sh --service-user dems-core --camera-interface enp3s0 --camera-address 192.168.50.1
expect 'given values: the script exits 0 in print-only mode' [ "$(code_of values)" = 0 ]
expect 'given values replace the placeholders in the rule file' grep -q 'meta skuid != "dems-core" counter' "$RUN/out/values.txt"
expect 'given values replace the placeholders in the address file' grep -q '        - 192.168.50.1/24' "$RUN/out/values.txt"
expect 'given values reach the command line of a step' \
  grep -q 'would-run: ufw allow in on enp3s0 proto udp from any port 3702' "$RUN/out/values.txt"
if grep -qE '<(service-user|camera-interface|camera-address)>' "$RUN/out/values.txt"; then
  bad 'no placeholder of a given value is left'
else
  ok 'no placeholder of a given value is left'
fi
expect 'programs started so far: 0' [ "$(log_lines)" = 0 ]

printf '%s\n' '--- 6. the apply branch of the two writing functions, against the doubles'
# No script is run here and no guard is switched off: the functions of the shared file are
# called directly with the apply mode set, with a PATH that holds only the doubles and the
# stand-in for mktemp.
code=0
/usr/bin/env -i PATH="$RUN/doubles:$RUN/real" HOME="$RUN/home" TMPDIR="$RUN/tmp" /bin/bash -c '
  set -eu
  . "$1"
  HP_SCRIPT=unit
  HP_APPLY=1
  HP_SERVICE_USER=dems-core
  act useradd --system --shell /usr/sbin/nologin "$HP_SERVICE_USER"
  put_file "$2/target.conf" 0644 root root <<EOF
user <service-user>
EOF
  hp_done
' unit "$LIB" "$RUN/sink" >"$RUN/out/unit.txt" 2>"$RUN/out/unit.err" || code=$?
expect 'the functions complete in apply mode against the doubles' [ "$code" = 0 ]
expect 'act started exactly the command it printed' grep -q '^useradd --system --shell /usr/sbin/nologin dems-core$' "$LOG"
expect 'put_file handed the file to install with mode and owner' \
  grep -qE "^install -m 0644 -o root -g root $RUN/tmp/[^ ]+ $RUN/sink/target.conf\$" "$LOG"
staged=$(sed -n 's/^install -m 0644 -o root -g root \([^ ]*\) .*/\1/p' "$LOG")
expect 'the staged content has the placeholder replaced' [ "$(cat "$staged" 2>/dev/null)" = 'user dems-core' ]
expect 'the summary counts 1 command and 1 file' grep -q 'commands run 1; files written 1$' "$RUN/out/unit.txt"
expect 'the doubles recorded 3 calls in all (useradd, install, rm)' [ "$(log_lines)" = 3 ]
expect 'nothing was written at the target (install is a double)' [ ! -e "$RUN/sink" ]

printf '%s\n' '--- 7. nothing changed outside the temporary folder of the run'
manifest >"$RUN/manifest.after"
expect 'files changed under scripts/host/: 0 (checksums before and after are equal)' cmp -s "$RUN/manifest.before" "$RUN/manifest.after"
if [ -e "$RUN/git.before" ]; then
  git -C "$HERE" status --porcelain -- . >"$RUN/git.after" 2>/dev/null || :
  expect 'git status of scripts/host/ is the same before and after' cmp -s "$RUN/git.before" "$RUN/git.after"
fi
expect 'the home folder of the run is empty' empty_dir "$RUN/home"
expect 'the working folder of the run is empty' empty_dir "$RUN/cwd"

printf '%s\n' '--- 8. shellcheck'
if command -v shellcheck >/dev/null 2>&1; then
  # shellcheck disable=SC2086
  if (cd "$HERE" && shellcheck -x -s bash host-profile-lib.sh $ALL_SCRIPTS test_host_profile_scripts.sh); then
    ok 'shellcheck reports nothing'
  else
    bad 'shellcheck reports nothing'
  fi
else
  printf 'SKIPPED shellcheck is not installed on this machine: not run\n'
fi

printf '\nRESULT: %s passed, %s failed\n' "$PASSED" "$FAILED"
[ "$FAILED" = 0 ]
