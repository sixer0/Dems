#!/bin/bash
# Shared scaffolding of the two tests of the hardware acceptance collectors. SOURCED by
# test_hw_collectors_host.sh and test_hw_collectors_camera.sh, never run by itself.
#
# How a collector is tested on the development machine: it runs with an empty environment and the
# test seam of hw-collect-lib.sh (HWA_TEST_DIR), so that
#   - its PATH holds ONLY the folder $SEAM/bin: recording doubles of every reading tool, recording
#     doubles of tools a collector must never start, and plain wrappers of the two text tools the
#     library uses (awk, date). A started tool is either recorded or "command not found";
#   - the fixed paths it reads (/etc/os-release, /proc, /run/dems-core-netalias, /etc/passwd) are
#     taken under $SEAM/root, where the test puts canned files.
# What this shows: the collector names its check, prints the expected fields from canned input,
# starts nothing but allowed readers, writes only into the evidence folder it was given, masks a
# planted credential-shaped value, and refuses politely off Ubuntu unless --dry is asked.
# What it does NOT show: anything about a host. No real tool of Ubuntu was run.

HERE=$(cd "$(dirname "$0")" && pwd)
RUN=$(mktemp -d "${TMPDIR:-/tmp}/dems-hw-collect-test.XXXXXX")
if [ -n "${HW_TEST_KEEP:-}" ]; then printf 'kept: %s\n' "$RUN"; else trap 'rm -rf "$RUN"' EXIT; fi
SEAM="$RUN/seam"
CANNED="$RUN/canned"
EVID="$RUN/evidence"
LOG="$RUN/recorded.log"
mkdir -p "$SEAM/bin" "$SEAM/root/etc" "$SEAM/root/proc" "$RUN/home" "$RUN/tmp" "$RUN/cwd" "$RUN/out" "$CANNED" "$EVID" \
  "$RUN/notubuntu/bin" "$RUN/notubuntu/root/etc" "$RUN/drybin/bin"
: >"$LOG"

# Recording doubles: the reading tools, and tools no collector may start. Each records its name
# and arguments, prints the canned text for it if the test stored one ($CANNED/<tool>@<first
# argument> or $CANNED/<tool>), and exits with $CANNED/<tool>.rc or 0.
READERS='ss ps getent findmnt stat df namei sha256sum lsusb uname lsb_release ldd nproc readlink id ldconfig sysctl timedatectl systemctl dpkg ip node npm make'
NEVER='sudo kill pkill killall apt apt-get nft ufw arping nc tee cp mv install chmod chown useradd usermod journalctl arecord curl wget tcpdump tshark psql python3 sh netplan reboot shutdown runuser fuser touch ln dd ffprobe ffmpeg'
make_double() { # make_double <folder> <tool>
  cat >"$1/$2" <<EOF
#!/bin/bash
printf '%s %s\n' "$2" "\$*" >>"$LOG"
first=\${1:-}
first=\${first//[^A-Za-z0-9_.-]/_}
if [ -f "$CANNED/$2@\$first" ]; then /bin/cat "$CANNED/$2@\$first"; elif [ -f "$CANNED/$2" ]; then /bin/cat "$CANNED/$2"; fi
if [ -f "$CANNED/$2.rc" ]; then exit "\$(/bin/cat "$CANNED/$2.rc")"; fi
exit 0
EOF
  chmod 0755 "$1/$2"
}
for tool in $READERS $NEVER; do
  make_double "$SEAM/bin" "$tool"
  make_double "$RUN/notubuntu/bin" "$tool"
  make_double "$RUN/drybin/bin" "$tool"
done
# The text tools of the library: pure filters, not recorded. The dry folder has NONE of them: a
# dry run that started even awk or date would fail with "command not found".
for tool in awk date; do
  real=$(command -v "$tool")
  printf '#!/bin/bash\nexec %s "$@"\n' "$real" >"$SEAM/bin/$tool"
  chmod 0755 "$SEAM/bin/$tool"
  cp "$SEAM/bin/$tool" "$RUN/notubuntu/bin/$tool"
done
printf 'NAME="Ubuntu"\nVERSION_ID="24.04"\nID=ubuntu\n' >"$SEAM/root/etc/os-release"
printf 'NAME="Other Linux"\nVERSION_ID="12"\nID=other\n' >"$RUN/notubuntu/root/etc/os-release"

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
can() { cat >"$CANNED/$1"; }      # can <tool or tool@first-argument>: canned output from standard input
uncan() { rm -f "$CANNED"/*; }
log_lines() { wc -l <"$LOG" | tr -d ' '; }
empty_dir() { [ -z "$(ls -A "$1")" ]; }

# collect <name> <seam folder> <script> <argument>...: runs a collector with an empty environment.
collect() {
  local name=$1 seam=$2 script=$3 code=0
  shift 3
  LOG_BEFORE=$(log_lines)
  (cd "$RUN/cwd" && /usr/bin/env -i HWA_TEST_DIR="$seam" HOME="$RUN/home" TMPDIR="$RUN/tmp" \
    /bin/bash "$HERE/$script" "$@") >"$RUN/out/$name.txt" 2>"$RUN/out/$name.err" || code=$?
  printf '%s' "$code" >"$RUN/out/$name.code"
  tail -n +"$((LOG_BEFORE + 1))" "$LOG" >"$RUN/out/$name.log"
}
code_of() { cat "$RUN/out/$1.code"; }
has() { grep -qF -- "$2" "$RUN/out/$1.txt"; }       # has <name> <text>
lacks() { ! grep -qF -- "$2" "$RUN/out/$1.txt"; }
file_has() { grep -qF -- "$2" "$EVID/$1"; }          # file_has <evidence file> <text>

# The closed list of what a collector may start, as the doubles record it (one ERE per line).
ALLOWED_RE='^(ss -H -ltn$|ps -(eo|axo) pid=,(ppid=,)?(comm|args)=$|getent (passwd|group) |findmnt -no |stat -c |df -B1 |namei -l /|sha256sum /|lsusb ?$|uname -m$|lsb_release -ds$|ldd /|readlink /|id -nG |ldconfig -p$|sysctl -n |timedatectl show |systemctl (is-active|is-enabled|show|list-unit-files) |dpkg -[sSl] |ip -br -4 addr show dev [A-Za-z0-9_.-]+$|ip -4 addr show dev [A-Za-z0-9_.-]+$|ip -4 route show default$|ip -4 neigh show dev [A-Za-z0-9_.-]+$|node --version$|node /[^ ]*/scripts/secret-scan/count-only\.mjs /|npm --prefix /[^ ]+ run db:status -- --database dems_(demo|lane_[1-3])$|ffmpeg -hide_banner -(version|devices)$|ffmpeg -hide_banner -nostdin -v (error|info) .* -f null -$|ffprobe -hide_banner -v error )'
# What must never be started, whatever the argument.
NEVER_RE='^(sudo|kill|pkill|killall|apt|apt-get|nft|ufw|arping|nc|tee|cp|mv|install|chmod|chown|useradd|usermod|journalctl|arecord|curl|wget|tcpdump|tshark|psql|python3|sh|netplan|reboot|shutdown|runuser|fuser|touch|ln|dd) |^systemctl (start|stop|restart|reload|enable|disable|mask|unmask|kill|daemon-reload|edit|set-property)|^ip .*(add|del|change|replace|flush|set) '
only_readers() { ! grep -vE "$ALLOWED_RE" "$RUN/out/$1.log" | grep -q .; }
no_forbidden() { ! grep -qE "$NEVER_RE" "$RUN/out/$1.log"; }

# The standard assertions of a collecting run. std <name> <check id> <evidence file> [<expected exit code>]
std() {
  local name=$1 check=$2 file=$3 want=${4:-0}
  expect "$name: exit code $want (collected; never a verdict)" [ "$(code_of "$name")" = "$want" ]
  expect "$name: names its check $check" has "$name" "check $check"
  expect "$name: quotes the pass criterion of the chapter" has "$name" 'pass criterion (chapter'
  expect "$name: says it is not a verdict" has "$name" 'NOT A VERDICT'
  expect "$name: marks the output as taken with doubles" has "$name" 'TEST DOUBLES IN USE'
  expect "$name: wrote the one file $file into the evidence folder" [ -s "$EVID/$file" ]
  expect "$name: the file says its exit code never means PASS" file_has "$file" 'It never means PASS'
  expect "$name: started nothing but allowed readers" only_readers "$name"
  expect "$name: started no changing command" no_forbidden "$name"
  expect "$name: nothing on standard error" [ ! -s "$RUN/out/$name.err" ]
}

silent_and_unchanged() { [ ! -s "$RUN/out/$1.txt" ] && [ ! -s "$RUN/out/$1.log" ] && [ "$(ls -A "$EVID" | wc -l | tr -d ' ')" = "$2" ]; }
refused_cleanly() { [ "$(code_of "$1")" = 2 ] && [ ! -s "$RUN/out/$1.txt" ] && [ ! -s "$RUN/out/$1.log" ] && [ -s "$RUN/out/$1.err" ]; }

# A dry run: a seam folder WITHOUT awk and date and without an os-release file. dry <name> <script> <argument>...
dry() {
  local name=$1 before
  shift
  before=$(ls -A "$EVID" | wc -l | tr -d ' ')
  collect "$name" "$RUN/drybin" "$@" --dry --evidence "$EVID"
  expect "$name: --dry exits 0" [ "$(code_of "$name")" = 0 ]
  expect "$name: --dry states the mode DRY and names its check" grep -qE '^# mode: DRY' "$RUN/out/$name.txt"
  expect "$name: --dry started no program at all" [ ! -s "$RUN/out/$name.log" ]
  expect "$name: --dry wrote no file" [ "$(ls -A "$EVID" | wc -l | tr -d ' ')" = "$before" ]
  expect "$name: --dry prints nothing on standard error" [ ! -s "$RUN/out/$name.err" ]
}

# Off Ubuntu: refused politely, nothing read, nothing written. off_ubuntu <name> <script> <argument>...
off_ubuntu() {
  local name=$1 before
  shift
  before=$(ls -A "$EVID" | wc -l | tr -d ' ')
  collect "$name" "$RUN/notubuntu" "$@" --evidence "$EVID"
  expect "$name: refused off Ubuntu 24.04 with exit code 3" [ "$(code_of "$name")" = 3 ]
  expect "$name: the refusal says that nothing was read" grep -q 'Nothing was read' "$RUN/out/$name.err"
  expect "$name: the refusal names --dry" grep -q -- '--dry' "$RUN/out/$name.err"
  expect "$name: no step printed, no tool started, no file written" silent_and_unchanged "$name" "$before"
}

# refused <name> <script> <argument>...: a value outside its closed form.
refused() {
  local name=$1
  shift
  collect "$name" "$SEAM" "$@"
  expect "$name: refused with exit code 2, no step printed, no tool started" refused_cleanly "$name"
}

in_pkg() { (cd "$HERE" && "$@") || :; }
manifest() { (cd "$HERE" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256); }

# static <script>...: the rules that can be read from the text.
static_checks() {
  local s
  for s in "$@"; do
    expect "$s parses (bash -n)" /bin/bash -n "$HERE/$s"
    expect "$s starts with #!/bin/bash" [ "$(head -1 "$HERE/$s")" = '#!/bin/bash' ]
  done
}
# Lines of a collector that name sudo (or a changing verb) outside a comment and outside the text a
# collector PRINTS for the USER. Expected: none.
calls_in() { # calls_in <ERE> <script>...
  local re=$1
  shift
  (cd "$HERE" && grep -nE "$re" "$@" | grep -vE '^[^:]+:[0-9]+:[[:space:]]*#' |
    grep -vE '(user_step|by_user|hw_handed|expected|note|confirm|criterion|step|hw_line|hw_fail|judge|defer|printf|item|obs|HW_SUMMARY=)[[:space:](]' || :)
}
