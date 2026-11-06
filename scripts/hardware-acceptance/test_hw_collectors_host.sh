#!/bin/bash
# Test of the hardware acceptance collectors, host group (checks of chapter 2), for the
# development machine (macOS or any host that is not the acceptance host).
#
#   bash scripts/hardware-acceptance/test_hw_collectors_host.sh
#
# Every collector of the group runs with its tools replaced by recording doubles on a restricted
# PATH and with canned inputs (test_hw_common.sh says how). Asserted per collector: it names its
# check and quotes the criterion, prints the expected fields, starts nothing but allowed readers
# and no changing command, writes only its one file into the evidence folder it was given, and
# does not print a planted credential-shaped value. Per collector and mode: --dry starts no
# program and writes nothing; off Ubuntu 24.04 the collector refuses with exit code 3.
# NOTHING HERE IS PROVEN ON A HOST. It writes only inside one temporary folder, removed at the end.
set -eu
# shellcheck source=test_hw_common.sh
. "$(cd "$(dirname "$0")" && pwd)/test_hw_common.sh"

COLLECTORS='collect-h27.sh collect-h01.sh collect-h02.sh collect-h24.sh collect-h03.sh collect-h04.sh collect-h16.sh collect-h05.sh collect-h25.sh collect-h06.sh collect-h07.sh collect-h08.sh'
PLANTED_PASSWORD='hunter2-Planted-Pass'
PLANTED_LOCATOR="rtsp://admin:$PLANTED_PASSWORD@192.168.50.20:554/Streaming/Channels/101"

manifest >"$RUN/manifest.before"

printf '%s\n' '--- 1. static'
# shellcheck disable=SC2086
static_checks hw-collect-lib.sh $COLLECTORS test_hw_common.sh test_hw_collectors_host.sh
for s in $COLLECTORS; do
  expect "$s sets -eu" grep -q '^set -eu$' "$HERE/$s"
  expect "$s reads no file as shell text but the shared one" [ "$(grep -cE '^[[:space:]]*(\.|source)[[:space:]]' "$HERE/$s")" = 1 ]
  expect "$s has a dry mode through the shared hw_init" grep -q '^hw_init "\$@"$' "$HERE/$s"
done
# shellcheck disable=SC2086
expect 'no eval in the collectors or the library' [ -z "$(in_pkg grep -nE '(^|[;&|[:space:]])eval[[:space:]]' hw-collect-lib.sh $COLLECTORS)" ]
# shellcheck disable=SC2086
expect 'commands that call sudo in the collectors: 0 (the word occurs only in text printed for the USER)' [ -z "$(calls_in '(^|[;&|(`[:space:]])sudo[[:space:]]' hw-collect-lib.sh $COLLECTORS)" ]
# shellcheck disable=SC2086
expect 'commands that change an address, a service, a rule or a process in the collectors: 0' \
  [ -z "$(calls_in '(ip (addr|link|route) (add|del|change|replace|flush|set)|systemctl (start|stop|restart|enable|disable|kill|daemon-reload|mask)|nft (add|delete|flush)|[^a-z]kill -|apt-get|ufw (allow|deny|enable|disable))' hw-collect-lib.sh $COLLECTORS)" ]
# shellcheck disable=SC2086
expect 'options that take a password, a key or a token: 0' [ -z "$(in_pkg grep -noE -- '--[a-z-]*(pass|secret|token|credential|key)[a-z-]*\)' hw-collect-lib.sh $COLLECTORS)" ]
expect 'the library reads /etc/os-release only as text' [ -z "$(grep -n 'os-release' "$HERE/hw-collect-lib.sh" | grep -vE '#|\[ -r "\$HW_ROOT/etc/os-release" \]|done <"\$HW_ROOT/etc/os-release"|hw_fail')" ]
expect 'the probe source in the package is the one of the E-11b record (SHA-256)' \
  [ "$(shasum -a 256 "$HERE/e11b-announce-probe/probe.c" | cut -d' ' -f1)" = 6ed2cbdaf1bf2b428831c260d1e42bb2a9c40c6898c9d13ff2ee79697bf7bf1b ]

printf '%s\n' '--- 2. --dry: every collector and mode, with no tool at all on the path'
dry d27 collect-h27.sh
for m in profile announce series; do dry "d01$m" collect-h01.sh "--$m"; done
dry d02b collect-h02.sh --before
dry d02a collect-h02.sh --after
dry d24 collect-h24.sh --tools
dry d03d collect-h03.sh --disk
dry d03l collect-h03.sh --level
dry d04 collect-h04.sh
dry d16p collect-h16.sh --process
dry d16a collect-h16.sh --after-refusal
for m in installed journal core; do dry "d05$m" collect-h05.sh "--$m"; done
dry d25t collect-h25.sh --tool
dry d25s collect-h25.sh --state
dry d06s collect-h06.sh --state
dry d06a collect-h06.sh --audit
dry d07h collect-h07.sh --host
dry d07a collect-h07.sh --audit
dry d08c collect-h08.sh --config
dry d08s collect-h08.sh --session S1
dry d08f collect-h08.sh --first-second S1
expect 'the dry profile lists the 42 items HOST-01 to HOST-42' [ "$(grep -c '^== HOST-[0-9][0-9] ' "$RUN/out/d01profile.txt")" = 42 ]
expect 'the dry announce mode says which programs it would start' grep -q 'would-start: cc -std=c11' "$RUN/out/d01announce.txt"
expect 'programs started by the 23 dry runs: 0 (recording log empty)' [ "$(log_lines)" = 0 ]
expect 'the evidence folder is still empty' empty_dir "$EVID"

printf '%s\n' '--- 3. off Ubuntu 24.04: refused, nothing read'
off_ubuntu o27 collect-h27.sh
off_ubuntu o01 collect-h01.sh --profile
off_ubuntu o02 collect-h02.sh --before --core-pid 4242
off_ubuntu o16 collect-h16.sh --process --core-pid 4242
off_ubuntu o05 collect-h05.sh --installed
off_ubuntu o08 collect-h08.sh --session S1 --core-pid 4242
# Without the seam, on this machine as it is: the same refusal, before any tool is looked for.
code=0
(cd "$RUN/cwd" && /usr/bin/env -i HOME="$RUN/home" /bin/bash "$HERE/collect-h27.sh" --evidence "$EVID") >"$RUN/out/plain.txt" 2>"$RUN/out/plain.err" || code=$?
if [ -r /etc/os-release ] && grep -q '^ID=ubuntu$' /etc/os-release && grep -q '^VERSION_ID="24.04"$' /etc/os-release; then
  printf 'SKIPPED this machine is Ubuntu 24.04: the refusal without the seam cannot be shown here\n'
else
  expect 'without the seam, on this machine: exit code 3 and no output'' (1 of 2)' [ "$code" = 3 ]
  expect 'without the seam, on this machine: exit code 3 and no output'' (2 of 2)' [ ! -s "$RUN/out/plain.txt" ]
fi
expect 'the evidence folder is still empty' empty_dir "$EVID"

printf '%s\n' '--- 4. values: closed forms only'
refused r1 collect-h27.sh --evidence "$EVID" --service-user 'a;b'
refused r2 collect-h27.sh --evidence relative/path
refused r3 collect-h27.sh --evidence "$EVID" --no-such-option
refused r4 collect-h27.sh --evidence "$EVID" --password x
refused r5 collect-h01.sh --profile --evidence "$EVID" --camera-interface 'eth0;reboot'
refused r6 collect-h01.sh --announce --evidence "$EVID" --port 8554
refused r7 collect-h01.sh --announce --evidence "$EVID" --codec 'x;y'
refused r8 collect-h16.sh --process --evidence "$EVID" --core-pid '1;id'
refused r9 collect-h16.sh --process --evidence "$EVID" --core-log '$(touch planted)'
refused r10 collect-h16.sh --after-refusal --evidence "$EVID" --database postgres
refused r11 collect-h08.sh --session S9 --evidence "$EVID"
refused r12 collect-h02.sh --evidence "$EVID"
refused r13 collect-h02.sh --before --after --evidence "$EVID"
refused r14 collect-h27.sh --evidence "$EVID" --core-pid 4242
refused r15 collect-h03.sh --disk --evidence "$EVID" --data-dir '/srv/../etc'
expect 'no file was planted by a refused value' empty_dir "$RUN/cwd"
expect 'the evidence folder is still empty' empty_dir "$EVID"

printf '%s\n' '--- 5. collecting, against the doubles'

# --- 9A/H-27
can ps <<EOF
  101 /usr/sbin/sshd -D
  202 /opt/dems/core/node apps/core-server PASSWORD=$PLANTED_PASSWORD
  303 /usr/local/bin/mediamtx /etc/mediamtx.yml
EOF
can ss <<'EOF'
LISTEN 0 511 127.0.0.1:4420 0.0.0.0:*
LISTEN 0 128 127.0.0.1:8554 0.0.0.0:*
LISTEN 0 128 192.168.50.1:8000 0.0.0.0:*
EOF
can getent@passwd </dev/null
collect c27 "$SEAM" collect-h27.sh --evidence "$EVID" --service-user dems-core
std c27 9A/H-27 h27-run1.txt
expect 'c27: counts one mediamtx process' has c27 'processes whose command line holds mediamtx = 1'
expect 'c27: counts no uvicorn process' has c27 'processes whose command line holds uvicorn = 0'
expect 'c27: counts the listeners on 8554 and on 8000'' (1 of 2)' has c27 'listeners on port 8554 = 1'
expect 'c27: counts the listeners on 8554 and on 8000'' (2 of 2)' has c27 'listeners on port 8000 = 1'
expect 'c27: counts no account named dems' has c27 'accounts named dems = 0'
expect 'c27: prints the five sudo steps for the USER and runs none' [ "$(grep -c '^   USER    : ' "$RUN/out/c27.txt")" = 5 ]
expect 'c27: no line of the process list is printed (the planted value is absent)' lacks c27 "$PLANTED_PASSWORD"
collect c27again "$SEAM" collect-h27.sh --evidence "$EVID" --service-user dems-core
expect 'a second run with the same run number is refused: nothing is overwritten'' (1 of 2)' [ "$(code_of c27again)" = 2 ]
expect 'a second run with the same run number is refused: nothing is overwritten'' (2 of 2)' grep -q 'exists' "$RUN/out/c27again.err"
collect c27run2 "$SEAM" collect-h27.sh --evidence "$EVID" --run 2
expect 'run 2 writes h27-run2.txt' [ -s "$EVID/h27-run2.txt" ]

# --- 9A/H-01 --profile
uncan
can lsb_release <<'EOF'
Ubuntu 24.04.1 LTS
EOF
can uname <<'EOF'
x86_64
EOF
can systemctl@list-unit-files <<'EOF'
UNIT FILE STATE PRESET

0 unit files listed.
EOF
can systemctl@is-active <<'EOF'
active
EOF
can systemctl@is-enabled <<'EOF'
masked
masked
masked
masked
EOF
can systemctl@show <<'EOF'
After=time-sync.target dems-loopback-rule.service
Requires=dems-loopback-rule.service
LimitCORE=0
NoNewPrivileges=yes
EOF
can getent@passwd <<'EOF'
dems-core:x:997:997::/srv/dems/data:/usr/sbin/nologin
EOF
can namei <<'EOF'
f: /opt/dems/core/apps/capture-worker/build/capture-worker
drwxr-xr-x root root /
drwxr-xr-x root root opt
-rwxr-xr-x root root capture-worker
EOF
can findmnt <<'EOF'
ext4 /dev/nvme0n1p2
EOF
can node@--version <<'EOF'
v26.8.2
EOF
can dpkg@-s <<'EOF'
Status: install ok installed
Status: install ok installed
Status: install ok installed
Status: install ok installed
Status: install ok installed
Status: install ok installed
dpkg-query: package 'arping' is not installed and no information is available
EOF
can dpkg@-S <<'EOF'
iputils-arping: /usr/bin/arping
EOF
can dpkg@-l </dev/null
can ldconfig <<'EOF'
	libavformat.so.63 (libc6,x86-64) => /opt/dems/ffmpeg-9.0.2/lib/libavformat.so.63
EOF
can ldd <<'EOF'
	libavformat.so.63 => /opt/dems/ffmpeg-9.0.2/lib/libavformat.so.63 (0x00007f0000000000)
EOF
can ps <<'EOF'
    1 systemd
  202 node
  303 capture-worker
EOF
can ip@-br <<'EOF'
enp3s0 UP 192.168.50.1/24
EOF
can ip@-4 <<'EOF'
default via 10.20.30.1 dev eno1 proto dhcp
EOF
can sysctl <<'EOF'
0
0
EOF
can id <<'EOF'
dems-core audio dems-netalias
EOF
can timedatectl <<'EOF'
yes
EOF
can stat <<'EOF'
root root 644
EOF
mkdir -p "$SEAM/root/proc/sys/net/ipv4/conf/enp3s0" "$SEAM/root/var/crash" "$SEAM/prefix/bin"
printf '0\n' >"$SEAM/root/proc/sys/net/ipv4/conf/enp3s0/forwarding"
printf 'root:x:0:0:root:/root:/bin/bash\nsync:x:4:65534:sync:/bin:/bin/sync\nadminperson:x:1000:1000:A Person:/home/adminperson:/bin/bash\ndems-core:x:997:997::/srv/dems/data:/usr/sbin/nologin\n' >"$SEAM/root/etc/passwd"
make_double "$SEAM/prefix/bin" ffmpeg
can ffmpeg@-hide_banner <<'EOF'
ffmpeg version 9.0.2 Copyright (c) 2000-2026 the FFmpeg developers
libavformat    63.  1.102 / 63.  1.102
 D  alsa            ALSA audio input
EOF
cat >"$RUN/sudo-profile.txt" <<EOF
## HOST-06
dems-core dems-core 700
dems-core dems-core 700
## HOST-34 (a line that must never be printed as it is)
DEMS_DATABASE_URL=postgres://dems_owner:$PLANTED_PASSWORD@127.0.0.1:5432/dems_demo
EOF
collect c01p "$SEAM" collect-h01.sh --profile --evidence "$EVID" --service-user dems-core --install-dir /opt/dems/core \
  --data-dir /srv/dems/data --ffmpeg-prefix "$SEAM/prefix" --camera-interface enp3s0 --sudo-reads "$RUN/sudo-profile.txt"
std c01p 9A/H-01 h01-run1-profile.txt
expect 'c01p: 42 items, each with one reading word'' (1 of 2)' [ "$(grep -c '^== HOST-[0-9][0-9] ' "$RUN/out/c01p.txt")" = 42 ]
expect 'c01p: 42 items, each with one reading word'' (2 of 2)' [ "$(grep -cE '^   reading : HOST-[0-9]{2} (met|not met|to judge|deferred)' "$RUN/out/c01p.txt")" = 42 ]
expect 'c01p: HOST-01 reads met from the release line' has c01p 'reading : HOST-01 met'
expect 'c01p: HOST-08, -36, -39, -40, -42 are deferred with the check that reads them' [ "$(grep -cE '^   reading : HOST-(08|36|39|40|42) deferred \(read in 9A/H-1[67]' "$RUN/out/c01p.txt")" = 5 ]
expect 'c01p: a sudo item is left to the USER, never run' has c01p 'reading : HOST-06 to judge'
expect 'c01p: HOST-13 (loader) reads not met, because the canned prefix differs from the given one' has c01p 'reading : HOST-13 not met'
expect 'c01p: the four counts add up to 42' has c01p 'items in all (HOST-01 to HOST-42) = 42'
expect 'c01p: the database password of the handed-over file is masked' lacks c01p "$PLANTED_PASSWORD"
expect 'c01p: the mask is counted, not shown' grep -qE 'credential-shaped values masked in this file: [1-9]' "$EVID/h01-run1-profile.txt"
expect 'c01p: the service account is printed as <service-user>, the interface as <camera-interface>'' (1 of 2)' lacks c01p 'dems-core audio'
expect 'c01p: the service account is printed as <service-user>, the interface as <camera-interface>'' (2 of 2)' lacks c01p 'enp3s0 UP'
expect 'c01p: no name of another account is printed' lacks c01p adminperson
expect 'c01p: the site address of the default route is not printed' lacks c01p '10.20.30.1'

# --- 9A/H-01 --announce (the one mode that starts programs: compiler, probe, pusher)
uncan
mkdir -p "$RUN/state"
for tool in mkdir rm; do
  printf '#!/bin/bash\nprintf '"'"'%%s %%s\\n'"'"' %s "$*" >>%s\nexec /bin/%s "$@"\n' "$tool" "$LOG" "$tool" >"$SEAM/bin/$tool"
  chmod 0755 "$SEAM/bin/$tool"
done
make_double "$SEAM/bin" sleep
make_double "$SEAM/bin" pkg-config
can pkg-config <<'EOF'
-I/opt/dems/ffmpeg-9.0.2/include -L/opt/dems/ffmpeg-9.0.2/lib -lavformat -lavcodec -lavutil
EOF
# The compiler double writes a probe double at the -o path: it waits for the pusher double to say
# which address it announced, then prints the probe output the E-11b record shows for that case.
cat >"$SEAM/bin/cc" <<EOF
#!/bin/bash
printf 'cc %s\n' "\$*" >>"$LOG"
out=''
while [ \$# -gt 0 ]; do if [ "\$1" = -o ]; then out=\$2; fi; shift; done
/bin/cat >"\$out" <<'PROBE'
#!/bin/bash
printf 'probe %s\n' "\$*" >>"$LOG"
n=0
while [ ! -s "$RUN/state/announced" ] && [ \$n -lt 50 ]; do n=\$((n + 1)); /bin/sleep 0.1; done
case "\$(/bin/cat "$RUN/state/announced")" in *Xc5) /bin/cat "$RUN/probe.right" ;; *) /bin/cat "$RUN/probe.wrong" ;; esac
/bin/rm -f "$RUN/state/announced"
PROBE
/bin/chmod 0755 "\$out"
EOF
chmod 0755 "$SEAM/bin/cc"
cat >"$SEAM/prefix/bin/ffmpeg" <<EOF
#!/bin/bash
printf 'ffmpeg %s\n' "\$*" >>"$LOG"
for last in "\$@"; do :; done
printf '%s' "\$last" >"$RUN/state/announced"
printf "line='RTSP/1.0 200 OK'\n%.0s" 1 2 3 4
EOF
chmod 0755 "$SEAM/prefix/bin/ffmpeg"
cat >"$RUN/probe.right" <<'EOF'
PROBE libavformat=Lavf63.1.102 (63.1.102) mode=observe listener_url=rtsp://127.0.0.1:18563/e11b/Hs3kP9wQ2nVb7Xc5 listener_path=/e11b/Hs3kP9wQ2nVb7Xc5 needle=Hs3kP9wQ2nVb7Xc2
LOG t=    70.3ms phase=avformat_open_input level=56 ctx=listener class=AVFormatContext text=Parsing[62]: ANNOUNCE rtsp://127.0.0.1:18563/e11b/Hs3kP9wQ2nVb7Xc5 RTSP/1.0
LOG t=    70.5ms phase=avformat_open_input level=56 ctx=listener class=AVFormatContext text=Sending response:|RTSP/1.0 200 OK||CSeq: 2||Server: Lavf63.1.102
OPEN  t=    71.6ms avformat_open_input=0 (ok) log_messages=40 update_messages=0 differs_messages=0 io_open_calls=0 interrupt_refusals=0
RESULT mode=observe open=ok read_during_open=no announced_path=(none) listener_path=/e11b/Hs3kP9wQ2nVb7Xc5 equal=-1 packets=25 request_line_path=/e11b/Hs3kP9wQ2nVb7Xc5 request_line_equal=1 log_messages=404 io_open_calls=0
EOF
cat >"$RUN/probe.wrong" <<'EOF'
PROBE libavformat=Lavf63.1.102 (63.1.102) mode=observe listener_url=rtsp://127.0.0.1:18563/e11b/Hs3kP9wQ2nVb7Xc5 listener_path=/e11b/Hs3kP9wQ2nVb7Xc5 needle=Hs3kP9wQ2nVb7Xc2
LOG t=    88.0ms phase=avformat_open_input level=56 ctx=listener class=AVFormatContext text=Parsing[62]: ANNOUNCE rtsp://127.0.0.1:18563/e11b/Hs3kP9wQ2nVb7Xc2 RTSP/1.0
LOG t=    88.0ms phase=avformat_open_input level=24 ctx=listener class=AVFormatContext text=WARNING: Path /e11b/Hs3kP9wQ2nVb7Xc2 differs from expected /e11b/Hs3kP9wQ2nVb7Xc5
LOG t=    88.0ms phase=avformat_open_input level=32 ctx=listener class=AVFormatContext text=Updating control URI to rtsp://127.0.0.1:18563/e11b/Hs3kP9wQ2nVb7Xc2
LOG t=    88.2ms phase=avformat_open_input level=56 ctx=listener class=AVFormatContext text=Sending response:|RTSP/1.0 200 OK||CSeq: 2||Server: Lavf63.1.102
OPEN  t=    89.8ms avformat_open_input=0 (ok) log_messages=43 update_messages=1 differs_messages=2 io_open_calls=0 interrupt_refusals=0
RESULT mode=observe open=ok read_during_open=yes announced_path=/e11b/Hs3kP9wQ2nVb7Xc2 listener_path=/e11b/Hs3kP9wQ2nVb7Xc5 equal=0 packets=25 request_line_path=/e11b/Hs3kP9wQ2nVb7Xc2 request_line_equal=0 log_messages=407 io_open_calls=0
EOF
can ss <<'EOF'
LISTEN 0 5 127.0.0.1:18563 0.0.0.0:*
EOF
collect c01a "$SEAM" collect-h01.sh --announce --evidence "$EVID" --ffmpeg-prefix "$SEAM/prefix"
A="$RUN/out/c01a.txt"
expect 'c01a: exit code 0 and the one file h01-run1-announce.txt'' (1 of 2)' [ "$(code_of c01a)" = 0 ]
expect 'c01a: exit code 0 and the one file h01-run1-announce.txt'' (2 of 2)' [ -s "$EVID/h01-run1-announce.txt" ]
expect 'c01a: names its check and says that this mode starts programs'' (1 of 2)' has c01a 'check 9A/H-01'
expect 'c01a: names its check and says that this mode starts programs'' (2 of 2)' has c01a 'THIS MODE STARTS PROGRAMS'
expect 'c01a: six runs, three per path'' (1 of 2)' [ "$(grep -c 'the pusher announces <right>' "$A")" = 3 ]
expect 'c01a: six runs, three per path'' (2 of 2)' [ "$(grep -c 'the pusher announces <wrong>' "$A")" = 3 ]
expect 'c01a: one announce line at level 56 in 6 of 6 runs' [ "$(grep -c 'ANNOUNCE <address> RTSP/1.0: 1; level of each: 56' "$A")" = 6 ]
expect 'c01a: <n> equals the length of the request line in 6 of 6' [ "$(grep -c 'equal to the length of the request line: 1' "$A")" = 6 ]
expect 'c01a: the request line equals what the pusher sent in 6 of 6' [ "$(grep -cE 'as the pusher sent it: 1$' "$A")" = 6 ]
expect 'c01a: the line came before the answer to ANNOUNCE in 6 of 6' [ "$(grep -c 'before the answer to ANNOUNCE: yes' "$A")" = 6 ]
expect 'c01a: "Updating control URI to": 1 in the three wrong-path runs, 0 in the three right-path runs'' (1 of 2)' [ "$(grep -c 'Updating control URI to": 1' "$A")" = 3 ]
expect 'c01a: "Updating control URI to": 1 in the three wrong-path runs, 0 in the three right-path runs'' (2 of 2)' [ "$(grep -c 'Updating control URI to": 0' "$A")" = 3 ]
expect 'c01a: the pusher read 200 four times, the probe read 25 packets, in 6 of 6'' (1 of 2)' [ "$(grep -c 'statuses the pusher read: 200 x 4; other statuses: none' "$A")" = 6 ]
expect 'c01a: the pusher read 200 four times, the probe read 25 packets, in 6 of 6'' (2 of 2)' [ "$(grep -c 'packets the probe read: 25' "$A")" = 6 ]
expect 'c01a: the path texts are never printed' lacks c01a Hs3kP9wQ2nVb7Xc
expect 'c01a: the library version line is printed' has c01a 'library version line: libavformat=Lavf63.1.102 (63.1.102)'
expect 'c01a: started only what the mode declares (mkdir, pkg-config, cc, probe, pusher, ss, sleep, rm)' \
  [ -z "$(grep -vE "^(mkdir $EVID/h01-run1-announce\.work|pkg-config --cflags --libs libavformat libavcodec libavutil|cc -std=c11 -O2 -o $EVID/h01-run1-announce\.work/probe |probe 18563 |ffmpeg -hide_banner -nostdin -loglevel trace .* rtsp://127\.0\.0\.1:18563/e11b/[A-Za-z0-9]+|ss -H -ltn|sleep 0\.2|rm -rf $EVID/h01-run1-announce\.work)\$" "$RUN/out/c01a.log" | grep -vE '^(cc|probe|ffmpeg) ' || :)" ]
expect 'c01a: started no changing command' no_forbidden c01a
expect 'c01a: the work folder is gone; the evidence folder holds text files only'' (1 of 2)' [ ! -e "$EVID/h01-run1-announce.work" ]
expect 'c01a: the work folder is gone; the evidence folder holds text files only'' (2 of 2)' [ -z "$(ls -A "$EVID" | grep -v '\.txt$' || :)" ]
rm -f "$SEAM/bin/mkdir" "$SEAM/bin/rm" "$SEAM/bin/cc" "$SEAM/bin/sleep" "$SEAM/bin/pkg-config"
make_double "$SEAM/prefix/bin" ffmpeg

# --- 9A/H-01 --series
uncan
mkdir -p "$RUN/series/near_last_character"
cat >"$RUN/series.out" <<'EOF'
e2e: series 20261013, 9 checks, ports 127.0.0.1:8559 and :8561
av1_zero_switch_tap_r1                   expect PASS got PASS      rc 0       ok          load  1.20   12.0 s
gate_near_last_character                 expect PASS got PASS      rc 0       ok          load  1.20    9.0 s
gate_near_trailing_slash                 expect PASS got FAIL      rc 1       UNEXPECTED  load  1.20    9.0 s
gate_no_announce_line                    expect PASS got PASS      rc 0       ok          load  1.20    9.0 s
AGGREGATE EXIT CODE 1
exit 2
EOF
printf '{"level":"info","message":"ingest_connected","port":8559}\n{"level":"warn","message":"INGEST_ANNOUNCE_NOT_MATCHED","port":8561}\n' >"$RUN/series/near_last_character/worker.jsonl"
collect c01s "$SEAM" collect-h01.sh --series --evidence "$EVID" --series-output "$RUN/series.out" --series-dir "$RUN/series"
std c01s 9A/H-01 h01-run1-series.txt
expect 'c01s: prints the result line of each permanent case by its name' [ "$(grep -c 'permanent case: gate_' "$RUN/out/c01s.txt")" = 3 ]
expect 'c01s: counts the unexpected verdicts and prints both exit codes'' (1 of 2)' has c01s 'of them UNEXPECTED: 1'
expect 'c01s: counts the unexpected verdicts and prints both exit codes'' (2 of 2)' has c01s 'aggregate exit code printed by the series: 1; exit code of make as the USER appended it: 2'
expect 'c01s: counts the stream addresses in the worker log of the series folder (0)' has c01s 'path texts in the worker'"'"'s log and output) = 0'

# --- 9A/H-02
uncan
can ps <<'EOF'
 4242     1 node
 4300  4242 capture-worker
 4301  4300 ffmpeg
 4302  4300 ffmpeg
 5000     1 sshd
EOF
can ss <<'EOF'
LISTEN 0 128 127.0.0.1:8554 0.0.0.0:*
LISTEN 0 128 127.0.0.1:8556 0.0.0.0:*
LISTEN 0 511 127.0.0.1:4421 0.0.0.0:*
EOF
can readlink <<'EOF'
/opt/dems/ffmpeg-9.0.2/bin/ffmpeg
EOF
collect c02b "$SEAM" collect-h02.sh --before --evidence "$EVID" --core-pid 4242
std c02b 9A/H-02 h02-run1-before.txt
expect 'c02b: lists the three descendants with process id and short name'' (1 of 2)' [ "$(grep -cE '^   LISTED 43(00|01|02) (capture-worker|ffmpeg)$' "$RUN/out/c02b.txt")" = 3 ]
expect 'c02b: lists the three descendants with process id and short name'' (2 of 2)' has c02b 'descendants of the Core = 3'
expect 'c02b: counts the two camera listeners' has c02b 'listeners on ports 8554 to 8564 = 2 (not on a loopback address: 0)'
expect 'c02b: the kill is printed as the USER'"'"'s step, and no signal was sent'' (1 of 2)' has c02b 'sudo kill -KILL <core-pid>'
expect 'c02b: the kill is printed as the USER'"'"'s step, and no signal was sent'' (2 of 2)' no_forbidden c02b
can ps <<'EOF'
 4301 ffmpeg
 4302 sshd
 5000 sshd
EOF
can ss </dev/null
collect c02a "$SEAM" collect-h02.sh --after --at 10 --evidence "$EVID" --before-file "$EVID/h02-run1-before.txt"
std c02a 9A/H-02 h02-run1-after-10s.txt
expect 'c02a: one survivor, one process id reused, one gone'' (1 of 3)' has c02a 'SURVIVES 4301 ffmpeg'
expect 'c02a: one survivor, one process id reused, one gone'' (2 of 3)' has c02a 'REUSED   4302'
expect 'c02a: one survivor, one process id reused, one gone'' (3 of 3)' has c02a 'GONE     4300 capture-worker'
expect 'c02a: survivors at 10 s = 1; listeners 0'' (1 of 2)' has c02a 'existing at 10 s with the same short name (survivors) = 1'
expect 'c02a: survivors at 10 s = 1; listeners 0'' (2 of 2)' has c02a 'listeners on ports 8554 to 8564 = 0'
collect c02a60 "$SEAM" collect-h02.sh --after --at 60 --evidence "$EVID" --before-file "$EVID/h02-run1-before.txt"
expect 'c02a60: the 60 s reading has its own file' [ -s "$EVID/h02-run1-after-60s.txt" ]

# --- 9A/H-24
uncan
mkdir -p "$SEAM/root/bin" "$SEAM/root/usr/bin"
printf '#!/bin/sh\n' >"$SEAM/root/bin/ps"
chmod 0755 "$SEAM/root/bin/ps"
can ps <<'EOF'
    1 systemd
 4300 capture-worker
 4301 a-very-long-nam
EOF
collect c24 "$SEAM" collect-h24.sh --tools --evidence "$EVID"
std c24 9A/H-24 h24-run1-tools.txt
expect 'c24: /bin/ps exists, /usr/bin/readlink does not (as canned)'' (1 of 2)' has c24 '/bin/ps exists and is executable = yes'
expect 'c24: /bin/ps exists, /usr/bin/readlink does not (as canned)'' (2 of 2)' has c24 '/usr/bin/readlink exists and is executable = no'
expect 'c24: the longest short name is 15 characters' has c24 'longest short name: 15 characters'

# --- 9A/H-03
uncan
can findmnt <<'EOF'
ext4 /dev/nvme0n1p2 rw,relatime
EOF
collect c03d "$SEAM" collect-h03.sh --disk --evidence "$EVID" --media-dir /srv/dems/throwaway --data-dir /srv/dems/data
std c03d 9A/H-03 h03-run1-disk.txt
expect 'c03d: same source, and the file system type'' (1 of 2)' has c03d 'both folders on the same source = yes'
expect 'c03d: same source, and the file system type'' (2 of 2)' has c03d 'file system type of the acceptance media store = ext4'
expect 'c03d: says that the check is an observation, not a verdict' has c03d 'observation, not a verdict'
cat >"$RUN/core.log" <<EOF
{"level":30,"time":1791822964466,"code":"CAPTURE_FENCE_PASSED","operation":"REAL_PRODUCTION","msg":"capture fence passed"}
{"level":40,"time":1791822965000,"code":"CAPTURE_SYNC_LEVEL_NOT_FULL","sessionId":"S-1","deviceId":"cam-1","syncLevel":"FSYNC","msg":"sync level"}
{"level":40,"time":1791822965100,"code":"CAPTURE_SYNC_LEVEL_NOT_FULL","sessionId":"S-1","deviceId":"cam-2","syncLevel":"FSYNC","msg":"sync level"}
{"level":50,"time":1791822966000,"msg":"camera open failed","locator":"$PLANTED_LOCATOR","password":"$PLANTED_PASSWORD"}
{"level":50,"time":1791822967000,"msg":"a production Core does not start","code":"CAPTURE_HOST_INTERFACE_FILE_MISMATCH","operation":"REAL_PRODUCTION","reason":"INTERFACE_FILE_DIFFERS_FROM_ROW"}
EOF
printf '{"ts_us":1,"level":"info","message":"first_durable_fragment","cam":1,"bytes":1000,"sync":"FSYNC","sync_wanted":"F_FULLFSYNC"}\n' >"$RUN/worker.jsonl"
collect c03l "$SEAM" collect-h03.sh --level --evidence "$EVID" --core-log "$RUN/core.log" --worker-log "$RUN/worker.jsonl"
std c03l 9A/H-03 h03-run1-level.txt
expect 'c03l: one level line per camera file with its stated level' [ "$(grep -c 'deviceId=cam-[12] syncLevel=FSYNC' "$RUN/out/c03l.txt")" = 2 ]
expect 'c03l: the worker'"'"'s own statement of the level' has c03l 'cam=1 sync=FSYNC sync_wanted=F_FULLFSYNC'
expect 'c03l: counts the notice lines (0 in the canned log)' has c03l 'lines that hold EVIDENCE_VOLUME_SYNC_NOT_FULL = 0'
expect 'c03l: no line of the log is printed (the planted locator and password are absent)'' (1 of 2)' lacks c03l "$PLANTED_PASSWORD"
expect 'c03l: no line of the log is printed (the planted locator and password are absent)'' (2 of 2)' lacks c03l '192.168.50.20'

# --- 9A/H-04
printf '{"level":30,"msg":"boot"}\n{"level":60,"check":"capture.worker","code":"CAPTURE_WORKER_PROGRAM_UNUSABLE","msg":"the server stopped: boot"}\n' >"$RUN/boot1.log"
printf '{"level":30,"code":"CAPTURE_FENCE_PASSED","operation":"REAL_DEVELOPMENT","msg":"capture fence passed"}\n' >"$RUN/boot2.log"
printf '{"level":60,"check":"capture.host","code":"CAPTURE_HOST_LOOPBACK_RULE_MISSING","msg":"the server stopped: boot"}\n' >"$RUN/boot3.log"
printf '4\n0\n0\n4\n' >"$RUN/sudo-h04.txt"
collect c04 "$SEAM" collect-h04.sh --evidence "$EVID" --boot-log "$RUN/boot1.log" --boot-log "$RUN/boot2.log" --boot-log "$RUN/boot3.log" --sudo-reads "$RUN/sudo-h04.txt"
std c04 9A/H-04 h04-run1.txt 5
expect 'c04: step .1 names the worker program by its code' has c04 'step .1 | the fatal line: check=capture.worker code=CAPTURE_WORKER_PROGRAM_UNUSABLE'
expect 'c04: step .2 prints the operation with the fence and no fatal line'' (1 of 2)' has c04 'step .2 | operation printed with the fence: REAL_DEVELOPMENT'
expect 'c04: step .2 prints the operation with the fence and no fatal line'' (2 of 2)' has c04 'step .2 | the fatal line: none'
expect 'c04: step .3 names the code of the refused start' has c04 'code=CAPTURE_HOST_LOOPBACK_RULE_MISSING'
expect 'c04: the fourth boot log is reported as not handed over (exit code 5: a reading is missing)' has c04 'NOT HANDED OVER: the boot log of step .4'
expect 'c04: the listener counts the USER handed over are printed' [ "$(grep -c '^      handed  | ' "$RUN/out/c04.txt")" = 4 ]

# --- 9A/H-16
uncan
mkdir -p "$SEAM/root/proc/4242"
printf 'Limit                     Soft Limit           Hard Limit           Units\nMax core file size        0                    0                    bytes\nMax open files            1024                 524288               files\n' >"$SEAM/root/proc/4242/limits"
printf 'Name:\tnode\nUmask:\t0077\nGroups:\t29 985 \nNoNewPrivs:\t1\nCapPrm:\t0000000000000000\nCapEff:\t0000000000000000\nCapBnd:\t0000000000000000\nCapAmb:\t0000000000000000\nVmRSS:\t  90000 kB\n' >"$SEAM/root/proc/4242/status"
printf '/opt/node/bin/node\0--inspect=127.0.0.1:9229\0/opt/dems/core/apps/core-server/src/index.ts\0--db-password=%s\0' "$PLANTED_PASSWORD" >"$SEAM/root/proc/4242/cmdline"
can ss <<'EOF'
LISTEN 0 511 127.0.0.1:4420 0.0.0.0:*
LISTEN 0 128 192.168.50.1:22 0.0.0.0:*
EOF
can getent@group <<'EOF'
audio:x:29:dems-core,adminperson
dems-netalias:x:985:dems-core
EOF
printf '## listeners\n127.0.0.1:4420\n## node-options\n0\n' >"$RUN/sudo-h16.txt"
collect c16p "$SEAM" collect-h16.sh --process --evidence "$EVID" --core-pid 4242 --core-log "$RUN/core.log" --service-user dems-core --sudo-reads "$RUN/sudo-h16.txt"
std c16p 9A/H-16 h16-run1-process.txt
expect 'c16p: the capture operation of the fence line' has c16p 'operation=REAL_PRODUCTION'
expect 'c16p: the core-file limit line' has c16p 'Max core file size        0                    0'
expect 'c16p: the switches are COUNTED (1 of 4 arguments), no argument is printed'' (1 of 3)' has c16p 'of them a diagnostic-report, heap or debugger switch (HOST-36) = 1'
expect 'c16p: the switches are COUNTED (1 of 4 arguments), no argument is printed'' (2 of 3)' lacks c16p 'inspect='
expect 'c16p: the switches are COUNTED (1 of 4 arguments), no argument is printed'' (3 of 3)' lacks c16p "$PLANTED_PASSWORD"
expect 'c16p: NoNewPrivs, four capability lines, groups and umask; nothing else of the status file'' (1 of 2)' [ "$(grep -cE 'output  \| (NoNewPrivs|CapPrm|CapEff|CapBnd|CapAmb|Groups|Umask):' "$RUN/out/c16p.txt")" = 7 ]
expect 'c16p: NoNewPrivs, four capability lines, groups and umask; nothing else of the status file'' (2 of 2)' lacks c16p VmRSS
expect 'c16p: the group numbers without member lists'' (1 of 2)' has c16p 'audio=29 dems-netalias=985'
expect 'c16p: the group numbers without member lists'' (2 of 2)' lacks c16p adminperson
expect 'c16p: one listener that is not on a loopback address is counted, its address not printed'' (1 of 2)' has c16p 'not a loopback address: 1'
expect 'c16p: one listener that is not on a loopback address is counted, its address not printed'' (2 of 2)' lacks c16p '192.168.50.1'
expect 'c16p: the environment is never read: the USER hands over a count'' (1 of 2)' has c16p "grep -c '^NODE_OPTIONS='"
expect 'c16p: the environment is never read: the USER hands over a count'' (2 of 2)' [ "$(grep -c environ "$RUN/out/c16p.log" || :)" = 0 ]
can npm <<EOF
> db:status
database         dems_demo  owner dems_owner
schema version   7 (dbc-4)
connection       postgres://dems_owner:$PLANTED_PASSWORD@127.0.0.1:5432/dems_demo
  audit_log                142
  sessions                 12
  users                    6
EOF
printf '0\n' >"$RUN/sudo-h16b.txt"
collect c16a "$SEAM" collect-h16.sh --after-refusal --evidence "$EVID" --database dems_demo --install-dir /opt/dems/core --sudo-reads "$RUN/sudo-h16b.txt"
std c16a 9A/H-16 h16-run1-after-refusal.txt
expect 'c16a: exit code, session rows and schema version of db:status, and nothing else of its output'' (1 of 5)' has c16a 'exit code of db:status = 0'
expect 'c16a: exit code, session rows and schema version of db:status, and nothing else of its output'' (2 of 5)' has c16a 'rows of the table sessions = 12'
expect 'c16a: exit code, session rows and schema version of db:status, and nothing else of its output'' (3 of 5)' has c16a 'schema version printed = 7'
expect 'c16a: exit code, session rows and schema version of db:status, and nothing else of its output'' (4 of 5)' lacks c16a audit_log
expect 'c16a: exit code, session rows and schema version of db:status, and nothing else of its output'' (5 of 5)' lacks c16a "$PLANTED_PASSWORD"

# --- 9A/H-05
uncan
mkdir -p "$SEAM/root/etc/dems"
printf 'enp3s0\n' >"$SEAM/root/etc/dems/netalias-interface"
can getent@group <<'EOF'
dems-netalias:x:985:dems-core
EOF
can systemctl@is-active <<'EOF'
active
EOF
can stat <<'EOF'
root dems-netalias 660 socket /run/dems-core-netalias/socket
root root 644 regular file /etc/systemd/system/dems-core-netalias.socket
root root 644 regular file /etc/systemd/system/dems-core-netalias@.service
root root 755 regular file /usr/local/sbin/dems-core-netalias
root root 644 regular file /etc/dems/netalias-interface
EOF
can namei <<'EOF'
f: /usr/local/sbin/dems-core-netalias
drwxr-xr-x root root /
drwxr-xr-x root root usr
drwxr-xr-x root root local
drwxr-xr-x root root sbin
-rwxr-xr-x root root dems-core-netalias
EOF
can sha256sum <<'EOF'
1e758a24aaaa  /usr/local/sbin/dems-core-netalias
1111bbbb  /etc/systemd/system/dems-core-netalias.socket
2222cccc  /etc/systemd/system/dems-core-netalias@.service
EOF
can ip <<'EOF'
default via 10.20.30.1 dev eno1 proto dhcp
EOF
printf '/etc/sudoers:0\n/etc/sudoers.d/README:0\n' >"$RUN/sudo-h05.txt"
collect c05i "$SEAM" collect-h05.sh --installed --evidence "$EVID" --service-user dems-core --camera-interface enp3s0 --install-dir /opt/dems/core --sudo-reads "$RUN/sudo-h05.txt"
std c05i 9A/H-05 h05-run1-installed.txt
expect 'c05i: the group has exactly the service user as member' has c05i 'members: 1; the only member is <service-user>: yes'
expect 'c05i: owner, group and mode of the five objects' [ "$(grep -cE 'output  \| root (root|dems-netalias) (660|644|755) ' "$RUN/out/c05i.txt")" = 5 ]
expect 'c05i: the path of the helper: 5 components, none foreign, none writable, no link' has c05i 'components: 5; not owned by root: 0; writable by group or others: 0; symbolic links: 0'
expect 'c05i: the three hashes are printed and compared with the delivery (3 of 3 with the canned double)'' (1 of 2)' has c05i '1e758a24aaaa'
expect 'c05i: the three hashes are printed and compared with the delivery (3 of 3 with the canned double)'' (2 of 2)' has c05i 'installed hash equals the delivery'"'"'s (helper, socket unit, service unit, in this order) = 3 of 3'
expect 'c05i: says that chapter 4 governs the hashes' has c05i 'CHAPTER 4 GOVERNS'
expect 'c05i: the interface file: one line, the given interface, its name not printed'' (1 of 2)' has c05i 'lines: 1; names the interface given with --camera-interface: yes'
expect 'c05i: the interface file: one line, the given interface, its name not printed'' (2 of 2)' lacks c05i 'enp3s0'
expect 'c05i: the default route does not go through the camera interface' has c05i 'default routes: 1; through the camera interface: 0'
expect 'c05i: the sudoers search is the USER'"'"'s and its handed-over output is printed' has c05i 'handed  | /etc/sudoers:0'
cat >"$RUN/helper.journal" <<'EOF'
dems-core-netalias: caller_uid=997 verb=add address=203.0.113.10/24 result=ADDRESS_NOT_PRIVATE code=25
dems-core-netalias: caller_uid=997 verb=add address=192.168.77.5/16 result=PREFIX_NOT_24 code=21
dems-core-netalias: caller_uid=997 verb=- address=- result=REQUEST_MALFORMED code=14
dems-core-netalias: caller_uid=997 verb=del address=192.168.77.5/24 result=NOT_MARKED code=45
dems-core-netalias: caller_uid=0 verb=add address=192.168.77.5/16 result=PEER_NOT_SERVICE_USER code=12
EOF
can ip <<'EOF'
enp3s0 UP 192.168.50.1/24
EOF
collect c05j "$SEAM" collect-h05.sh --journal --evidence "$EVID" --journal-file "$RUN/helper.journal" --camera-interface enp3s0
std c05j 9A/H-05 h05-run1-journal.txt
expect 'c05j: five lines reduced to verb, result, code'' (1 of 3)' has c05j 'helper lines: 5'
expect 'c05j: five lines reduced to verb, result, code'' (2 of 3)' has c05j '1: verb=add result=ADDRESS_NOT_PRIVATE code=25'
expect 'c05j: five lines reduced to verb, result, code'' (3 of 3)' has c05j '5: verb=add result=PEER_NOT_SERVICE_USER code=12'
expect 'c05j: no address and no caller of a journal line is printed'' (1 of 3)' lacks c05j '192.168.77.5'
expect 'c05j: no address and no caller of a journal line is printed'' (2 of 3)' lacks c05j '203.0.113.10'
expect 'c05j: no address and no caller of a journal line is printed'' (3 of 3)' lacks c05j caller_uid
expect 'c05j: one address on the camera port' has c05j 'addresses on the camera port = 1'
collect c05c "$SEAM" collect-h05.sh --core --evidence "$EVID" --core-log "$RUN/core.log" --core-pid 4242
std c05c 9A/H-05 h05-run1-core.txt
expect 'c05c: one boot line names the helper, printed by its code only'' (1 of 2)' has c05c '1: level=50 code=CAPTURE_HOST_INTERFACE_FILE_MISMATCH reason=INTERFACE_FILE_DIFFERS_FROM_ROW'
expect 'c05c: one boot line names the helper, printed by its code only'' (2 of 2)' has c05c 'the interface file: 1'
expect 'c05c: the supplementary groups of the Core' has c05c 'Groups:'

# --- 9A/H-25
uncan
make_double "$SEAM/bin" arping-not-started
printf '#!/bin/bash\nexit 0\n' >"$SEAM/bin/arping"
chmod 0755 "$SEAM/bin/arping"
can dpkg@-S <<'EOF'
iputils-arping: /usr/bin/arping
EOF
can dpkg@-s <<'EOF'
dpkg-query: package 'arping' is not installed and no information is available
EOF
can stat <<'EOF'
root 755 /usr/bin/arping
root 755 /usr/sbin/ip
EOF
collect c25t "$SEAM" collect-h25.sh --tool --evidence "$EVID"
std c25t 9A/H-25 h25-run1-tool.txt
expect 'c25t: where arping is found (a built-in look-up; the tool itself is never started)'' (1 of 2)' has c25t 'command -v arping = '
expect 'c25t: where arping is found (a built-in look-up; the tool itself is never started)'' (2 of 2)' [ "$(grep -c '^arping' "$RUN/out/c25t.log" || :)" = 0 ]
expect 'c25t: the owning package, the absent other package, owner and mode of both tools'' (1 of 3)' has c25t 'iputils-arping: /usr/bin/arping'
expect 'c25t: the owning package, the absent other package, owner and mode of both tools'' (2 of 3)' has c25t 'is not installed'
expect 'c25t: the owning package, the absent other package, owner and mode of both tools'' (3 of 3)' has c25t 'root 755 /usr/sbin/ip'
rm -f "$SEAM/bin/arping" "$SEAM/bin/arping-not-started"
make_double "$SEAM/bin" arping
can ip <<'EOF'
2: enp3s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
    inet 192.168.50.1/24 brd 192.168.50.255 scope global enp3s0
       valid_lft forever preferred_lft forever
    inet 192.168.77.1/24 scope global enp3s0
       valid_lft 287sec preferred_lft 287sec
EOF
collect c25s "$SEAM" collect-h25.sh --state --evidence "$EVID" --camera-interface enp3s0 --at 2
std c25s 9A/H-25 h25-run1-state-2s.txt
expect 'c25s: two addresses with their lifetimes, no address printed'' (1 of 2)' has c25s 'addresses on the camera port = 2; valid_lft of each: forever 287sec'
expect 'c25s: two addresses with their lifetimes, no address printed'' (2 of 2)' lacks c25s '192.168.77.1'

# --- 9A/H-06
mkdir -p "$SEAM/root/run/dems-core-netalias/marks"
: >"$SEAM/root/run/dems-core-netalias/marks/192.168.77.1"
collect c06s "$SEAM" collect-h06.sh --state --evidence "$EVID" --camera-interface enp3s0 --core-pid 4242
std c06s 9A/H-06 h06-run1-state.txt
expect 'c06s: address count with valid_lft, one mark file, NoNewPrivs'' (1 of 3)' has c06s 'valid_lft of each: forever 287sec'
expect 'c06s: address count with valid_lft, one mark file, NoNewPrivs'' (2 of 3)' has c06s 'mark files of the helper = 1'
expect 'c06s: address count with valid_lft, one mark file, NoNewPrivs'' (3 of 3)' has c06s 'NoNewPrivs:'
expect 'c06s: the name of a mark file (an address) is not printed' lacks c06s '192.168.77.1'
collect c06s330 "$SEAM" collect-h06.sh --state --at 330 --evidence "$EVID" --camera-interface enp3s0
expect 'c06s330: the reading at 330 s has its own file and needs no Core'' (1 of 2)' [ -s "$EVID/h06-run1-state-330s.txt" ]
expect 'c06s330: the reading at 330 s has its own file and needs no Core'' (2 of 2)' [ "$(code_of c06s330)" = 0 ]
cat >"$RUN/audit.txt" <<'EOF'
{"seq":197,"type":"HOST_ALIAS_REQUESTED","details":{"action":"ADD","address":"192.168.77.1","reason":"FACTORY_SCAN","minutes":30}}
{"seq":198,"type":"HOST_ALIAS_ADDED","details":{"address":"192.168.77.1","reason":"FACTORY_SCAN","expiresAt":1791824764}}
{"seq":199,"type":"HOST_ALIAS_REQUESTED","details":{"action":"REMOVE","address":"192.168.77.1","removeReason":"MANUAL"}}
{"seq":200,"type":"HOST_ALIAS_REMOVED","details":{"address":"192.168.77.1","removeReason":"MANUAL"}}
{"seq":201,"type":"HOST_ALIAS_REQUESTED","details":{"action":"ADD","address":"192.168.77.1","reason":"FACTORY_SCAN","minutes":5}}
{"seq":202,"type":"HOST_ALIAS_ADDED","details":{"address":"192.168.77.1","reason":"FACTORY_SCAN","expiresAt":1791825064}}
{"seq":203,"type":"HOST_ALIAS_REQUESTED","details":{"action":"REMOVE","address":"192.168.77.1","removeReason":"BOOT_SWEEP"}}
{"seq":204,"type":"HOST_ALIAS_REMOVED","details":{"address":"192.168.77.1","removeReason":"BOOT_SWEEP"}}
{"seq":205,"type":"CAPTURE_DISCOVERY_SEARCHED","details":{"scope":"AUDIO_CARDS"}}
{"seq":206,"type":"CAPTURE_AUDIO_INPUT_CHANGED","details":{"change":"REGISTERED"}}
{"seq":207,"type":"CAPTURE_AUDIO_INPUT_CHANGED","details":{"change":"REGISTERED"}}
EOF
collect c06a "$SEAM" collect-h06.sh --audit --evidence "$EVID" --audit-file "$RUN/audit.txt"
std c06a 9A/H-06 h06-run1-audit.txt
expect 'c06a: counts per type'' (1 of 3)' has c06a 'lines that hold HOST_ALIAS_ADDED = 2'
expect 'c06a: counts per type'' (2 of 3)' has c06a 'lines that hold HOST_ALIAS_REMOVED = 2'
expect 'c06a: counts per type'' (3 of 3)' has c06a 'lines that hold HOST_ALIAS_REMOVE_FAILED = 0'
expect 'c06a: the entries in order with their reason code, no address'' (1 of 2)' has c06a '8: HOST_ALIAS_REMOVED reason=BOOT_SWEEP action=(absent)'
expect 'c06a: the entries in order with their reason code, no address'' (2 of 2)' lacks c06a '192.168.77.1'

# --- 9A/H-07
uncan
mkdir -p "$SEAM/root/proc/asound/card1"
printf ' 0 [PCH            ]: HDA-Intel - HDA Intel PCH\n                      HDA Intel PCH at 0xdf240000 irq 130\n 1 [USB            ]: USB-Audio - Scarlett 2i2 USB\n                      Focusrite Scarlett 2i2 USB at usb-0000:00:14.0-2, high speed, serial SN123456\n' >"$SEAM/root/proc/asound/cards"
printf 'Focusrite Scarlett 2i2 USB at usb-0000:00:14.0-2, high speed : USB Audio\n\nPlayback:\n  Interface 1\n    Channels: 2\nCapture:\n  Interface 2\n    Altset 1\n    Format: S32_LE\n    Channels: 2\n    Rates: 44100, 48000\n' >"$SEAM/root/proc/asound/card1/stream0"
can lsusb <<'EOF'
Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub
Bus 001 Device 004: ID 1235:8210 Focusrite-Novation Scarlett 2i2 3rd Gen
EOF
can id <<'EOF'
dems-core audio dems-netalias
EOF
collect c07h "$SEAM" collect-h07.sh --host --evidence "$EVID" --service-user dems-core
std c07h 9A/H-07 h07-run1-host.txt 5
expect 'c07h: vendor and product id of the interface; the hub is left out'' (1 of 2)' has c07h '1235:8210 Focusrite-Novation Scarlett 2i2 3rd Gen'
expect 'c07h: vendor and product id of the interface; the hub is left out'' (2 of 2)' lacks c07h 'root hub'
expect 'c07h: the card lines with the driver; the long line with a serial number is left out'' (1 of 3)' has c07h 'USB-Audio - Scarlett 2i2 USB'
expect 'c07h: the card lines with the driver; the long line with a serial number is left out'' (2 of 3)' lacks c07h SN123456
expect 'c07h: the card lines with the driver; the long line with a serial number is left out'' (3 of 3)' has c07h 'cards = 2; with the driver USB-Audio: 1'
expect 'c07h: the capture channel count of the USB stream' has c07h 'card 1: capture channel counts of its USB stream =  2'
expect 'c07h: the service user holds audio; arecord is the USER'"'"'s step and was not handed over (exit code 5)'' (1 of 2)' has c07h 'hold audio = yes'
expect 'c07h: the service user holds audio; arecord is the USER'"'"'s step and was not handed over (exit code 5)'' (2 of 2)' has c07h 'NOT HANDED OVER: "arecord -l as the service user"'
collect c07a "$SEAM" collect-h07.sh --audit --evidence "$EVID" --audit-file "$RUN/audit.txt"
std c07a 9A/H-07 h07-run1-audit.txt
expect 'c07a: counts searches, registrations and change codes'' (1 of 3)' has c07a 'lines that hold CAPTURE_DISCOVERY_SEARCHED = 1'
expect 'c07a: counts searches, registrations and change codes'' (2 of 3)' has c07a 'lines that hold REGISTERED = 2'
expect 'c07a: counts searches, registrations and change codes'' (3 of 3)' has c07a 'lines that hold CARD_CHANGED = 0'

# --- 9A/H-08
uncan
cat >"$RUN/alsa.conf" <<'EOF'
pcm.dems_card1 {
    type dsnoop
    ipc_key 5978293
    slave {
        pcm "hw:CARD=USB,DEV=0"
        channels 2
        rate 48000
        format S32_LE
        period_size 1024
        buffer_size 8192
    }
}
EOF
collect c08c "$SEAM" collect-h08.sh --config --evidence "$EVID" --alsa-config "$RUN/alsa.conf"
std c08c 9A/H-08 h08-run1-config.txt
expect 'c08c: one dsnoop block with channels, rate, format, period and buffer'' (1 of 6)' has c08c 'dsnoop blocks: 1'
expect 'c08c: one dsnoop block with channels, rate, format, period and buffer'' (2 of 6)' has c08c 'channels 2'
expect 'c08c: one dsnoop block with channels, rate, format, period and buffer'' (3 of 6)' has c08c 'rate 48000'
expect 'c08c: one dsnoop block with channels, rate, format, period and buffer'' (4 of 6)' has c08c 'format S32_LE'
expect 'c08c: one dsnoop block with channels, rate, format, period and buffer'' (5 of 6)' has c08c 'period_size 1024'
expect 'c08c: one dsnoop block with channels, rate, format, period and buffer'' (6 of 6)' has c08c 'buffer_size 8192'
expect 'c08c: says that a silent input is a FAIL' has c08c 'a silent input is a FAIL'
can ps <<'EOF'
 4242     1 node
 4300  4242 capture-worker
 4301  4242 ffmpeg
 4302  4242 ffmpeg
EOF
mkdir -p "$SEAM/root/proc/4301" "$SEAM/root/proc/4302"
printf '/opt/ffmpeg/bin/ffmpeg\0-thread_queue_size\0001024\0-f\0alsa\0-c:a\0pcm_s24le\0-ch_layout\0002C\0-sample_rate\00048000\0-i\0dems_card1\0-af\0pan=mono|c0=c0\0-y\0/srv/dems/data/run/capture/mic1.fifo\0' >"$SEAM/root/proc/4301/cmdline"
printf '/opt/ffmpeg/bin/ffmpeg\0-thread_queue_size\0001024\0-f\0alsa\0-c:a\0pcm_s24le\0-ch_layout\0002C\0-sample_rate\00048000\0-i\0dems_card1\0-af\0pan=mono|c0=c1\0' >"$SEAM/root/proc/4302/cmdline"
printf '{"ts_us":1,"level":"info","message":"session_starting","cameras":2,"mics":2}\n{"ts_us":2,"level":"info","message":"audio_started","encoders":1,"quantum_samples":480}\n' >"$RUN/worker.jsonl"
collect c08s "$SEAM" collect-h08.sh --session S1 --evidence "$EVID" --core-pid 4242 --core-log "$RUN/core.log" --worker-log "$RUN/worker.jsonl"
std c08s 9A/H-08 h08-run1-session-S1.txt
expect 'c08s: two helper processes, each reduced to format, channel count, rate and selection'' (1 of 3)' has c08s 'helper process 4301: -f alsa -ch_layout 2C -sample_rate 48000 -af pan=mono|c0=c0'
expect 'c08s: two helper processes, each reduced to format, channel count, rate and selection'' (2 of 3)' has c08s 'helper process 4302: -f alsa -ch_layout 2C -sample_rate 48000 -af pan=mono|c0=c1'
expect 'c08s: two helper processes, each reduced to format, channel count, rate and selection'' (3 of 3)' has c08s 'named ffmpeg) = 2'
expect 'c08s: no other argument of a helper is printed'' (1 of 2)' lacks c08s mic1.fifo
expect 'c08s: no other argument of a helper is printed'' (2 of 2)' lacks c08s dems_card1
expect 'c08s: counts of failed or busy opens, and what the worker states'' (1 of 2)' has c08s 'lines that hold AUDIO_HELPER_EXITED = 0'
expect 'c08s: counts of failed or busy opens, and what the worker states'' (2 of 2)' has c08s 'quantum_samples=480'
can ffmpeg <<'EOF'
[Parsed_volumedetect_0 @ 0x55] n_samples: 48000
[Parsed_volumedetect_0 @ 0x55] mean_volume: -71.2 dB
[Parsed_volumedetect_0 @ 0x55] max_volume: -58.4 dB
EOF
printf 'not a real track\n' >"$RUN/s1-audio.mp4"
collect c08f "$SEAM" collect-h08.sh --first-second S1 --evidence "$EVID" --track "$RUN/s1-audio.mp4" --ffmpeg-prefix "$SEAM/prefix"
std c08f 9A/H-08 h08-run1-first-second-S1.txt
expect 'c08f: two peak figures and nothing else of the decode'' (1 of 2)' [ "$(grep -c 'relative to full scale) = -58.4 dB' "$RUN/out/c08f.txt")" = 2 ]
expect 'c08f: two peak figures and nothing else of the decode'' (2 of 2)' lacks c08f mean_volume
expect 'c08f: the track is decoded into nothing, twice (-f null -)' [ "$(grep -cE '^ffmpeg -hide_banner -nostdin -v info .* -vn -af volumedetect -f null -$' "$RUN/out/c08f.log")" = 2 ]

printf '%s\n' '--- 6. nothing was written outside the evidence folder; nothing in the package changed'
manifest >"$RUN/manifest.after"
expect 'files changed under scripts/hardware-acceptance/: 0 (checksums before and after are equal)' cmp -s "$RUN/manifest.before" "$RUN/manifest.after"
expect 'the working folder of the runs is empty' empty_dir "$RUN/cwd"
expect 'the home folder of the runs is empty' empty_dir "$RUN/home"
expect 'the temporary folder handed to the collectors is empty' empty_dir "$RUN/tmp"
expect 'the evidence folder holds only files named h<NN>-run<k>...txt' [ -z "$(ls -A "$EVID" | grep -vE '^h[0-9]{2}-run[0-9]+(-[A-Za-z0-9-]+)?\.txt$' || :)" ]
expect 'the planted password is in no evidence file' [ -z "$(grep -rlF -- "$PLANTED_PASSWORD" "$EVID" || :)" ]
scan=0
node "$HERE/../secret-scan/count-only.mjs" "$EVID" >"$RUN/out/scan.txt" 2>&1 || scan=$?
expect 'the product'"'"'s count-only scan finds no credential form in the evidence folder (exit 0, TOTAL: 0)' [ "$scan" = 0 ]
expect 'no tool that a collector must never start was recorded in the whole run' [ -z "$(grep -E "$NEVER_RE" "$LOG" || :)" ]

printf '%s\n' '--- 7. shellcheck'
if command -v shellcheck >/dev/null 2>&1; then
  # shellcheck disable=SC2086
  if (cd "$HERE" && shellcheck -x -s bash hw-collect-lib.sh $COLLECTORS test_hw_common.sh test_hw_collectors_host.sh); then
    ok 'shellcheck reports nothing'
  else
    bad 'shellcheck reports nothing'
  fi
else
  printf 'SKIPPED shellcheck is not installed on this machine: not run\n'
fi

printf '\nRESULT: %s passed, %s failed (host group; nothing here is proven on a host)\n' "$PASSED" "$FAILED"
[ "$FAILED" = 0 ]
