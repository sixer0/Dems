#!/bin/bash
# Test of the hardware acceptance collectors, camera and session group (checks of chapter 3), and
# of the record writer, for the development machine.
#
#   bash scripts/hardware-acceptance/test_hw_collectors_camera.sh
#
# As the host group's test (test_hw_common.sh says how): recording doubles on a restricted PATH,
# canned logs and listings. Asserted per collector: it names its check and quotes the criterion,
# prints the expected fields, starts nothing but allowed readers, writes only its one file into
# the evidence folder, and prints no planted credential, stream address, token or address.
# NOTHING HERE IS PROVEN ON A HOST. It writes only inside one temporary folder, removed at the end.
set -eu
# shellcheck source=test_hw_common.sh
. "$(cd "$(dirname "$0")" && pwd)/test_hw_common.sh"

COLLECTORS='collect-h12.sh collect-h13.sh collect-h15.sh collect-h14.sh collect-h10.sh collect-h23.sh collect-h17.sh collect-h21.sh collect-h09.sh collect-h26.sh collect-h18.sh collect-h22.sh collect-h11.sh collect-h19.sh'
PLANTED_PASSWORD='hunter2-Planted-Pass'
PLANTED_LOCATOR="rtsp://admin:$PLANTED_PASSWORD@192.168.50.20:554/Streaming/Channels/101"
PLANTED_TOKEN='Profile_token_7Zq'
PLANTED_MAC='AA:BB:CC:11:22:33'
ALLOWED_RE="$ALLOWED_RE|^ps -eo pid=,ppid=,user=,comm=\$|^df -B1 --output=avail,size /"

manifest >"$RUN/manifest.before"

printf '%s\n' '--- 1. static'
# shellcheck disable=SC2086
static_checks $COLLECTORS record-line.sh test_hw_collectors_camera.sh
for s in $COLLECTORS; do
  expect "$s sets -eu" grep -q '^set -eu$' "$HERE/$s"
  expect "$s has a dry mode through the shared hw_init" grep -q '^hw_init "\$@"$' "$HERE/$s"
  expect "$s says that it takes no password and captures no packets" grep -q 'takes no password as an argument' "$HERE/$s"
done
# shellcheck disable=SC2086
expect 'no eval in the collectors or the record writer' [ -z "$(in_pkg grep -nE '(^|[;&|[:space:]])eval[[:space:]]' $COLLECTORS record-line.sh)" ]
# shellcheck disable=SC2086
expect 'commands that call sudo: 0 (the word occurs only in text printed for the USER)' [ -z "$(calls_in '(^|[;&|(`[:space:]])sudo[[:space:]]' $COLLECTORS record-line.sh)" ]
# shellcheck disable=SC2086
expect 'commands that change a camera, an address, a service or a process: 0' \
  [ -z "$(calls_in '(ip (addr|link|route) (add|del|change|replace|flush|set)|systemctl (start|stop|restart|enable|disable|kill)|[^a-z]kill -|curl|wget|onvif|tcpdump|tshark)' $COLLECTORS record-line.sh)" ]
# shellcheck disable=SC2086
expect 'options that take a password, a key or a token: 0' [ -z "$(in_pkg grep -noE -- '--[a-z-]*(pass|secret|token|credential|key)[a-z-]*[ )|]' $COLLECTORS record-line.sh | grep -v 'No option takes' || :)" ]
expect 'chapter 3 names no collector for 9A/H-20 (it has no SCRIPT step), and none exists' [ ! -e "$HERE/collect-h20.sh" ]

printf '%s\n' '--- 2. --dry: every collector and mode, with no tool at all on the path'
dry d12 collect-h12.sh
dry d13s collect-h13.sh --state
dry d13a collect-h13.sh --audit
dry d15 collect-h15.sh
dry d14s collect-h14.sh --state
dry d14a collect-h14.sh --audit
dry d10 collect-h10.sh --camera CAM-A
dry d23t collect-h23.sh --after-test
dry d23s collect-h23.sh --after-session S1
dry d17l collect-h17.sh --live
dry d17s collect-h17.sh --sealed S1
dry d21 collect-h21.sh --session S1
dry d09l collect-h09.sh --live
dry d09s collect-h09.sh --session S1
dry d09f collect-h09.sh --file S1
dry d26 collect-h26.sh --session S1
dry d18 collect-h18.sh --session S1
dry d22 collect-h22.sh --session S2
dry d11 collect-h11.sh --session S3
dry d19b collect-h19.sh --before
dry d19s collect-h19.sh --session S4
expect 'programs started by the 21 dry runs: 0 (recording log empty)' [ "$(log_lines)" = 0 ]
expect 'the evidence folder is still empty' empty_dir "$EVID"

printf '%s\n' '--- 3. off Ubuntu 24.04: refused, nothing read'
off_ubuntu o12 collect-h12.sh
off_ubuntu o14 collect-h14.sh --state --camera-interface enp3s0
off_ubuntu o17 collect-h17.sh --live --core-pid 4242
off_ubuntu o18 collect-h18.sh --session S1 --clap 10:00:15 --start 10:00:00
expect 'the evidence folder is still empty' empty_dir "$EVID"

printf '%s\n' '--- 4. values: closed forms only'
refused r1 collect-h10.sh --evidence "$EVID" --camera 192.168.1.20
refused r2 collect-h10.sh --evidence "$EVID" --camera CAM-A --password x
refused r3 collect-h18.sh --session S1 --evidence "$EVID" --clap 25:00:00
refused r4 collect-h18.sh --session S5 --evidence "$EVID"
refused r5 collect-h14.sh --state --evidence "$EVID" --camera-interface lo
refused r6 collect-h17.sh --sealed --evidence "$EVID"
refused r7 collect-h09.sh --file S1 --evidence "$EVID" --track '$(touch planted)'
expect 'no file was planted by a refused value' empty_dir "$RUN/cwd"

printf '%s\n' '--- 5. collecting, against the doubles'
cat >"$RUN/core.log" <<EOF
{"level":30,"time":1791822964466,"code":"CAPTURE_FENCE_PASSED","operation":"REAL_PRODUCTION","msg":"capture fence passed"}
{"level":30,"time":1791822965000,"code":"CAPTURE_DISCOVERY_SEARCHED","scope":"CAMERA_NETWORK","candidates":2,"msg":"search"}
{"level":30,"time":1791822965500,"code":"CAPTURE_DISCOVERY_SEARCHED","scope":"CAMERA_NETWORK","candidates":1,"msg":"search"}
{"level":30,"time":1791822966000,"code":"CAMERA_CONNECTION_TESTED","outcome":"REACHABLE","durationMs":2140,"profiles":2,"codec":"HEVC","msg":"tested"}
{"level":30,"time":1791822966100,"code":"CAMERA_PROFILE_LISTED","profileCode":"HEVC_1080P","codec":"HEVC","width":1920,"height":1080,"tokenOutsideCodeForm":true,"tokenDigitsOnly":false,"listed":true,"token":"$PLANTED_TOKEN","msg":"profile"}
{"level":50,"time":1791822966200,"msg":"camera open failed","locator":"$PLANTED_LOCATOR","password":"$PLANTED_PASSWORD"}
{"level":40,"time":1791822967000,"code":"CAPTURE_SYNC_LEVEL_NOT_FULL","deviceId":"cam-1","syncLevel":"FSYNC","msg":"sync"}
{"level":40,"time":1791822967100,"code":"EVIDENCE_VOLUME_SYNC_NOT_FULL","syncLevel":"FSYNC","critical":true,"msg":"notice"}
{"level":30,"time":1791822967200,"code":"CAMERA_CLOCK_OFFSET","deviceId":"cam-2","offsetMs":640,"msg":"offset"}
{"level":40,"time":1791822968000,"code":"CAPTURE_FAULT","deviceId":"cam-1","reason":"CAMERA_STREAM_ENDED","state":"RAISED","msg":"fault"}
EOF
cat >"$RUN/worker.jsonl" <<'EOF'
{"ts_us":1000000000,"level":"info","source":"capture-worker.main","message":"session_starting","cameras":2,"port1":8559,"port2":8561,"mics":2}
{"ts_us":1004200000,"level":"info","source":"capture-worker.ingest1","message":"ingest_connected","port":8559,"codec":"hevc","width":1920,"height":1080,"extradata":112}
{"ts_us":1006900000,"level":"info","source":"capture-worker.ingest2","message":"ingest_connected","port":8561,"codec":"hevc","width":1920,"height":1080,"extradata":110}
{"ts_us":1300000000,"level":"info","source":"capture-worker.main","message":"worker_stopping","why":"stop"}
{"ts_us":1300100000,"level":"info","source":"capture-worker.main","message":"camera_summary","cam":1,"video_packets":7500,"audio_packets":14000,"fragments":150,"durable_fragments":150,"bytes":90000000,"dropped_no_pts":0,"dropped_prestart":12,"retimed":3,"sync":"FSYNC"}
{"ts_us":1300200000,"level":"info","source":"capture-worker.main","message":"camera_summary","cam":2,"video_packets":7498,"audio_packets":14000,"fragments":150,"durable_fragments":150,"bytes":88000000,"dropped_no_pts":0,"dropped_prestart":9,"retimed":0,"sync":"FSYNC"}
{"ts_us":1300300000,"level":"info","source":"capture-worker.main","message":"worker_exit","rc":0,"code":""}
EOF
cat >"$RUN/audit.txt" <<EOF
{"seq":301,"type":"CAPTURE_DISCOVERY_SEARCHED","details":{"scope":"CAMERA_NETWORK"}}
{"seq":302,"type":"CAPTURE_DISCOVERY_SEARCHED","details":{"scope":"CAMERA_NETWORK"}}
{"seq":303,"type":"CAMERA_FACTORY_SCANNED","details":{"found":1}}
{"seq":304,"type":"HOST_ALIAS_ADDED","details":{}}
{"seq":305,"type":"HOST_ALIAS_REMOVED","details":{}}
{"seq":306,"type":"CAMERA_NETWORK_SET","details":{"hardwareAddress":"$PLANTED_MAC"}}
{"seq":307,"type":"CAPTURE_DEVICE_ADOPTED","details":{}}
{"seq":308,"type":"CAPTURE_CONFIG_CHANGED","details":{}}
{"seq":309,"type":"CAPTURE_CREDENTIAL_REVEALED","details":{}}
{"seq":310,"type":"CAPTURE_CREDENTIAL_REVEALED","details":{}}
EOF
printf 'clean error log line\n' >"$RUN/error.log"
can node <<'EOF'
scanned 2 file(s); skipped 0 (not readable or above 67108864 bytes)
camera-credential: 0
ingest-secret: 0
TOTAL: 0 in 0 file(s)
EOF
can ip <<'EOF'
2: enp3s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    inet 192.168.50.1/24 brd 192.168.50.255 scope global enp3s0
       valid_lft forever preferred_lft forever
EOF
can ip@-4 <<'EOF'
2: enp3s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    inet 192.168.50.1/24 brd 192.168.50.255 scope global enp3s0
       valid_lft forever preferred_lft forever
192.168.50.21 lladdr aa:bb:cc:11:22:33 REACHABLE
192.168.50.22 lladdr 00:11:22:33:44:55 STALE
EOF
mkdir -p "$SEAM/root/run/dems-core-netalias/marks" "$SEAM/root/proc/4242" "$SEAM/prefix/bin"
printf 'Name:\tnode\nCapPrm:\t0000000000000000\nCapEff:\t0000000000000000\nCapBnd:\t0000000000000000\nCapAmb:\t0000000000000000\n' >"$SEAM/root/proc/4242/status"
make_double "$SEAM/prefix/bin" ffmpeg
make_double "$SEAM/prefix/bin" ffprobe
printf 'not a real track\n' >"$RUN/track.mp4"
ARGS_LOGS="--core-log $RUN/core.log --install-dir /opt/dems/core"

# --- 9A/H-12
collect c12 "$SEAM" collect-h12.sh --evidence "$EVID" --audit-file "$RUN/audit.txt" --core-log "$RUN/core.log"
std c12 9A/H-12 h12-run1.txt
expect 'c12: two search entries with the scope of the camera network'' (1 of 2)' has c12 'lines that hold CAPTURE_DISCOVERY_SEARCHED = 2'
expect 'c12: two search entries with the scope of the camera network'' (2 of 2)' has c12 'lines that hold CAMERA_NETWORK = 2'
expect 'c12: the candidate count of each search'' (1 of 2)' has c12 'scope=CAMERA_NETWORK candidates=2'
expect 'c12: the candidate count of each search'' (2 of 2)' has c12 'scope=CAMERA_NETWORK candidates=1'

# --- 9A/H-13
collect c13s "$SEAM" collect-h13.sh --state --evidence "$EVID" --camera-interface enp3s0
std c13s 9A/H-13 h13-run1-state.txt
expect 'c13s: one address on the camera port, no mark file, no address printed'' (1 of 3)' has c13s 'addresses on the camera port = 1; valid_lft of each: forever'
expect 'c13s: one address on the camera port, no mark file, no address printed'' (2 of 3)' has c13s 'mark files of the helper = 0'
expect 'c13s: one address on the camera port, no mark file, no address printed'' (3 of 3)' lacks c13s '192.168.50.1'
# shellcheck disable=SC2086
collect c13a "$SEAM" collect-h13.sh --audit --evidence "$EVID" --audit-file "$RUN/audit.txt" $ARGS_LOGS
std c13a 9A/H-13 h13-run1-audit.txt
expect 'c13a: scan, added and removed entries'' (1 of 3)' has c13a 'lines that hold CAMERA_FACTORY_SCANNED = 1'
expect 'c13a: scan, added and removed entries'' (2 of 3)' has c13a 'lines that hold HOST_ALIAS_ADDED = 1'
expect 'c13a: scan, added and removed entries'' (3 of 3)' has c13a 'lines that hold HOST_ALIAS_REMOVED = 1'
expect 'c13a: the search for a secret is the product'"'"'s count-only scan and prints a number'' (1 of 2)' has c13a 'count-only scan = TOTAL 0 (exit 0)'
expect 'c13a: the search for a secret is the product'"'"'s count-only scan and prints a number'' (2 of 2)' grep -qE '^node /opt/dems/core/scripts/secret-scan/count-only\.mjs /' "$RUN/out/c13a.log"

# --- 9A/H-15
collect c15 "$SEAM" collect-h15.sh --evidence "$EVID" --audit-file "$RUN/audit.txt" --camera-interface enp3s0
std c15 9A/H-15 h15-run1.txt
expect 'c15: the count of set-address entries and of addresses'' (1 of 2)' has c15 'lines that hold CAMERA_NETWORK_SET = 1'
expect 'c15: the count of set-address entries and of addresses'' (2 of 2)' has c15 'addresses on the camera port = 1'
expect 'c15: reminds that no password is typed in this check' has c15 'No password is typed in this check'

# --- 9A/H-14
printf '%s\n' "$PLANTED_MAC" >"$RUN/hwaddr.txt"
collect c14s "$SEAM" collect-h14.sh --state --evidence "$EVID" --camera-interface enp3s0 --hw-address-file "$RUN/hwaddr.txt"
std c14s 9A/H-14 h14-run1-state.txt
expect 'c14s: the neighbour table holds the hardware address: yes; the address itself is never printed'' (1 of 4)' has c14s 'hardware address on the camera port = yes'
expect 'c14s: the neighbour table holds the hardware address: yes; the address itself is never printed'' (2 of 4)' lacks c14s 'aa:bb:cc'
expect 'c14s: the neighbour table holds the hardware address: yes; the address itself is never printed'' (3 of 4)' lacks c14s 'AA:BB:CC'
expect 'c14s: the neighbour table holds the hardware address: yes; the address itself is never printed'' (4 of 4)' lacks c14s '192.168.50.21'
printf '00:00:00:00:00:01\n' >"$RUN/hwaddr-other.txt"
collect c14s2 "$SEAM" collect-h14.sh --state --run 2 --evidence "$EVID" --camera-interface enp3s0 --hw-address-file "$RUN/hwaddr-other.txt"
expect 'c14s2: another hardware address: no' has c14s2 'hardware address on the camera port = no'
can node.rc <<'EOF'
1
EOF
can node <<'EOF'
scanned 3 file(s); skipped 0 (not readable or above 67108864 bytes)
camera-credential: 1
ingest-secret: 0
HIT core.log: camera-credential=1
TOTAL: 1 in 1 file(s)
EOF
# shellcheck disable=SC2086
collect c14a "$SEAM" collect-h14.sh --audit --evidence "$EVID" --audit-file "$RUN/audit.txt" --error-log "$RUN/error.log" $ARGS_LOGS
std c14a 9A/H-14 h14-run1-audit.txt
expect 'c14a: one set-address entry; a hit of the scan is reported as a security finding, by count'' (1 of 3)' has c14a 'lines that hold CAMERA_NETWORK_SET = 1'
expect 'c14a: one set-address entry; a hit of the scan is reported as a security finding, by count'' (2 of 3)' has c14a 'AT LEAST ONE HIT (exit 1): a security finding'
expect 'c14a: one set-address entry; a hit of the scan is reported as a security finding, by count'' (3 of 3)' has c14a 'camera-credential: 1'
expect 'c14a: the three places are scanned together' grep -qE "count-only\.mjs $RUN/core.log $RUN/error.log $RUN/audit.txt\$" "$RUN/out/c14a.log"
rm -f "$CANNED/node.rc"
can node <<'EOF'
scanned 2 file(s); skipped 0 (not readable or above 67108864 bytes)
camera-credential: 0
ingest-secret: 0
TOTAL: 0 in 0 file(s)
EOF

# --- 9A/H-10
# shellcheck disable=SC2086
collect c10 "$SEAM" collect-h10.sh --camera CAM-A --evidence "$EVID" --audit-file "$RUN/audit.txt" --error-log "$RUN/error.log" $ARGS_LOGS
std c10 9A/H-10 h10-run1-CAM-A.txt
expect 'c10: the outcome and the duration of the test in milliseconds' has c10 'outcome=REACHABLE reason=(absent) durationMs=2140'
expect 'c10: per profile its code, codec, picture size and the three token facts' has c10 'profileCode=HEVC_1080P codec=HEVC width=1920 height=1080 tokenOutsideCodeForm=true tokenDigitsOnly=false listed=true'
expect 'c10: no token, no stream address, no account, no password is printed'' (1 of 4)' lacks c10 "$PLANTED_TOKEN"
expect 'c10: no token, no stream address, no account, no password is printed'' (2 of 4)' lacks c10 "$PLANTED_PASSWORD"
expect 'c10: no token, no stream address, no account, no password is printed'' (3 of 4)' lacks c10 'Streaming/Channels'
expect 'c10: no token, no stream address, no account, no password is printed'' (4 of 4)' lacks c10 'admin'
expect 'c10: the adoption and the configuration change are counted'' (1 of 2)' has c10 'lines that hold CAPTURE_CONFIG_CHANGED = 1'
expect 'c10: the adoption and the configuration change are counted'' (2 of 2)' has c10 'lines that hold ADOPTED = 1'
expect 'c10: the count-only scan ran over the Core log and the error log' has c10 'count-only scan = TOTAL 0 (exit 0)'

# --- 9A/H-23
# shellcheck disable=SC2086
collect c23t "$SEAM" collect-h23.sh --after-test --evidence "$EVID" --error-log "$RUN/error.log" $ARGS_LOGS
std c23t 9A/H-23 h23-run1-after-test.txt
expect 'c23t: the outcome code and the codec read from the stream'' (1 of 2)' has c23t 'outcome=REACHABLE'
expect 'c23t: the outcome code and the codec read from the stream'' (2 of 2)' has c23t 'codec=HEVC'
# shellcheck disable=SC2086
collect c23s "$SEAM" collect-h23.sh --after-session S1 --evidence "$EVID" --worker-log "$RUN/worker.jsonl" --error-log "$RUN/error.log" $ARGS_LOGS
std c23s 9A/H-23 h23-run1-after-session-S1.txt
expect 'c23s: whether each camera track holds video (packets above 0)'' (1 of 2)' has c23s 'cam=1 video_packets=7500'
expect 'c23s: whether each camera track holds video (packets above 0)'' (2 of 2)' has c23s 'cam=2 video_packets=7498'
expect 'c23s: the scan covers the worker log as well' grep -qE "count-only\.mjs $RUN/core.log $RUN/error.log $RUN/worker.jsonl\$" "$RUN/out/c23s.log"

# --- 9A/H-17
can ps <<'EOF'
 4242     1 dems-core node
 4300  4242 dems-core capture-worker
 4301  4242 dems-core dems-relay
 4302  4242 dems-core dems-relay
 4303  4242 dems-core ffmpeg
 4304  4242 otheruser ffmpeg
 5000     1 root sshd
EOF
can ss <<'EOF'
LISTEN 0 511 127.0.0.1:4420 0.0.0.0:*
LISTEN 0 128 127.0.0.1:8559 0.0.0.0:*
LISTEN 0 128 127.0.0.1:8561 0.0.0.0:*
EOF
printf '0\n0\n2\n' >"$RUN/sudo-h17.txt"
collect c17l "$SEAM" collect-h17.sh --live --evidence "$EVID" --core-pid 4242 --service-user dems-core --sudo-reads "$RUN/sudo-h17.txt"
std c17l 9A/H-17 h17-run1-live.txt
expect 'c17l: five processes of the session, one not owned by the service user, no account name printed'' (1 of 3)' has c17l 'processes of the session: 5; not owned by the service user: 1'
expect 'c17l: five processes of the session, one not owned by the service user, no account name printed'' (2 of 3)' has c17l 'process 4304 ffmpeg owner: another account'
expect 'c17l: five processes of the session, one not owned by the service user, no account name printed'' (3 of 3)' lacks c17l otheruser
expect 'c17l: the listeners, all on a loopback address' has c17l 'on ports 8554 to 8564: 2; with a local address that is not a loopback address (any account): 0'
expect 'c17l: the four capability lines' [ "$(grep -cE 'output  \| Cap(Prm|Eff|Bnd|Amb):' "$RUN/out/c17l.txt")" = 4 ]
expect 'c17l: the run directory modes are the USER'"'"'s sudo reading, printed as handed over' [ "$(grep -c '^      handed  | ' "$RUN/out/c17l.txt")" = 3 ]
# shellcheck disable=SC2086
collect c17s "$SEAM" collect-h17.sh --sealed S1 --evidence "$EVID" --worker-log "$RUN/worker.jsonl" --audit-file "$RUN/audit.txt" --error-log "$RUN/error.log" $ARGS_LOGS
std c17s 9A/H-17 h17-run1-sealed-S1.txt 5
expect 'c17s: the capture operation, the sync level per camera file and the notice with "critical"'' (1 of 3)' has c17s 'operation=REAL_PRODUCTION'
expect 'c17s: the capture operation, the sync level per camera file and the notice with "critical"'' (2 of 3)' has c17s 'deviceId=cam-1 syncLevel=FSYNC'
expect 'c17s: the capture operation, the sync level per camera file and the notice with "critical"'' (3 of 3)' has c17s 'syncLevel=FSYNC critical=true'
expect 'c17s: both camera tracks with their packets and sizes; the worker'"'"'s exit code'' (1 of 2)' has c17s 'cam=1 video_packets=7500 audio_packets=14000 fragments=150 durable_fragments=150 bytes=90000000 sync=FSYNC'
expect 'c17s: both camera tracks with their packets and sizes; the worker'"'"'s exit code'' (2 of 2)' has c17s 'rc=0'
expect 'c17s: two credential reveals counted' has c17s 'lines that hold CREDENTIAL_REVEAL = 2'
expect 'c17s: state, sources and verification are OPER'"'"'s readings; no script signs in' has c17s 'No script signs in to the Core'
expect 'c17s: the listing of the tracks was not handed over (exit code 5: a reading is missing)' has c17s 'NOT HANDED OVER: "the tracks of the package with their sizes"'
expect 'c17s: nothing of the planted log line is printed'' (1 of 2)' lacks c17s "$PLANTED_PASSWORD"
expect 'c17s: nothing of the planted log line is printed'' (2 of 2)' lacks c17s '192.168.50.20'

# --- 9A/H-21
collect c21 "$SEAM" collect-h21.sh --session S1 --evidence "$EVID" --worker-log "$RUN/worker.jsonl" --core-log "$RUN/core.log"
std c21 9A/H-21 h21-run1-session-S1.txt
expect 'c21: the two differences in milliseconds and the larger figure'' (1 of 3)' has c21 'camera on port 8559 (hevc): connect report 4200 ms'
expect 'c21: the two differences in milliseconds and the larger figure'' (2 of 3)' has c21 'camera on port 8561 (hevc): connect report 6900 ms'
expect 'c21: the two differences in milliseconds and the larger figure'' (3 of 3)' has c21 'the larger figure: 6900 ms'
expect 'c21: the count of camera faults' has c21 'lines that hold CAPTURE_FAULT = 1'

# --- 9A/H-09
collect c09s "$SEAM" collect-h09.sh --session S1 --evidence "$EVID" --worker-log "$RUN/worker.jsonl" --core-log "$RUN/core.log"
std c09s 9A/H-09 h09-run1-session-S1.txt
expect 'c09s: the connect line per camera (codec, picture size, parameter-set length)' has c09s 'port=8559 codec=hevc width=1920 height=1080 extradata=112'
expect 'c09s: no INGEST_NO_EXTRADATA line; the three counters of the summing line'' (1 of 2)' has c09s 'lines that hold INGEST_NO_EXTRADATA = 0'
expect 'c09s: no INGEST_NO_EXTRADATA line; the three counters of the summing line'' (2 of 2)' has c09s 'cam=1 video_packets=7500 fragments=150 dropped_no_pts=0 dropped_prestart=12 retimed=3'
expect 'c09s: the clock offset of a camera in milliseconds' has c09s 'deviceId=cam-2 offsetMs=640'
can ffprobe <<'EOF'
codec_name=hevc
codec_tag_string=hev1
nb_read_frames=7500
EOF
can ffmpeg </dev/null
collect c09f "$SEAM" collect-h09.sh --file S1 --camera CAM-A --evidence "$EVID" --track "$RUN/track.mp4" --ffmpeg-prefix "$SEAM/prefix"
std c09f 9A/H-09 h09-run1-file-S1-CAM-A.txt
expect 'c09f: codec, sample entry and frame count of the file'' (1 of 3)' has c09f 'codec_name=hevc'
expect 'c09f: codec, sample entry and frame count of the file'' (2 of 3)' has c09f 'codec_tag_string=hev1'
expect 'c09f: codec, sample entry and frame count of the file'' (3 of 3)' has c09f 'nb_read_frames=7500'
expect 'c09f: the decode error lines are counted (0), decoded into nothing'' (1 of 2)' has c09f 'error lines of the full decode = 0'
expect 'c09f: the decode error lines are counted (0), decoded into nothing'' (2 of 2)' grep -qE '^ffmpeg -hide_banner -nostdin -v error -i .* -f null -$' "$RUN/out/c09f.log"

# --- 9A/H-26
collect c26 "$SEAM" collect-h26.sh --session S1 --evidence "$EVID" --core-log "$RUN/core.log" --worker-log "$RUN/worker.jsonl"
std c26 9A/H-26 h26-run1-session-S1.txt
expect 'c26: the notice count (0) and the codec of each camera'' (1 of 2)' has c26 'lines that hold STREAM_PROFILE_DIFFERS = 0'
expect 'c26: the notice count (0) and the codec of each camera'' (2 of 2)' has c26 'port=8561 codec=hevc'

# --- 9A/H-18 (and 9A/H-19 step .5)
can ffmpeg <<'EOF'
frame:0    pts:0       pts_time:0
lavfi.astats.Overall.Peak_level=-61.2
frame:1    pts:480     pts_time:0.01
lavfi.astats.Overall.Peak_level=-60.8
frame:499  pts:239520  pts_time:4.99
lavfi.astats.Overall.Peak_level=-60.1
frame:500  pts:240000  pts_time:5.00
lavfi.astats.Overall.Peak_level=-3.4
frame:501  pts:240480  pts_time:5.01
lavfi.astats.Overall.Peak_level=-9.9
EOF
collect c18 "$SEAM" collect-h18.sh --session S1 --clap 10:00:15 --start 10:00:00 --camera CAM-A --evidence "$EVID" --track "$RUN/track.mp4" --ffmpeg-prefix "$SEAM/prefix"
std c18 9A/H-18 h18-run1-session-S1-CAM-A-clap100015.txt
expect 'c18: 15 s from the start click to the clap; the window starts 5 s before it'' (1 of 2)' has c18 'by the two host clock readings = 15'
expect 'c18: 15 s from the start click to the clap; the window starts 5 s before it'' (2 of 2)' grep -qE '^ffmpeg -hide_banner -nostdin -v error -ss 10 -t 10 -i ' "$RUN/out/c18.log"
expect 'c18: the sharpest rise at 15000 ms in the track, 56.7 dB' has c18 '15000 ms in the track; rise 56.7 dB to a peak of -3.4 dB; blocks read 5'
expect 'c18: numbers only; says that the picture frame is read by OPER' has c18 'read frame by frame by OPER'

# --- 9A/H-22
collect c22 "$SEAM" collect-h22.sh --session S2 --evidence "$EVID" --worker-log "$RUN/worker.jsonl" --core-log "$RUN/core.log" --audit-file "$RUN/audit.txt"
std c22 9A/H-22 h22-run1-session-S2.txt 5
expect 'c22: the time to the connect reports; the tracks per camera'' (1 of 2)' has c22 'connect report, port 8559: 4200 ms'
expect 'c22: the time to the connect reports; the tracks per camera'' (2 of 2)' has c22 'cam=2 video_packets=7498 fragments=150 bytes=88000000'
expect 'c22: warnings and audit entries for an absent camera are counted'' (1 of 2)' has c22 'Core log: lines that hold CAMERA_NOT_CONNECTED = 0'
expect 'c22: warnings and audit entries for an absent camera are counted'' (2 of 2)' has c22 'audit list: lines that hold CAMERA_NOT_CONNECTED = 0'

# --- 9A/H-11
can ffprobe <<'EOF'
0.000000
0.040000
0.080000
42.120000
42.160000
EOF
can ffmpeg <<'EOF'
[hevc @ 0x55] Could not find ref with POC 12
EOF
collect c11 "$SEAM" collect-h11.sh --session S3 --evidence "$EVID" --core-log "$RUN/core.log" --worker-log "$RUN/worker.jsonl" --audit-file "$RUN/audit.txt" --camera CAM-A --track "$RUN/track.mp4" --ffmpeg-prefix "$SEAM/prefix"
std c11 9A/H-11 h11-run1-session-S3-CAM-A.txt
expect 'c11: the fault with its device, reason and state' has c11 'deviceId=cam-1 reason=CAMERA_STREAM_ENDED state=RAISED'
expect 'c11: one gap in the track, its length in milliseconds' has c11 '5 packets; gaps longer than 1 s: 1; the longest distance between two packets: 42040 ms'
expect 'c11: the decode error lines are counted, not printed'' (1 of 2)' has c11 'error lines of the full decode = 1'
expect 'c11: the decode error lines are counted, not printed'' (2 of 2)' lacks c11 'Could not find ref'
expect 'c11: the credential reveals of the session' has c11 'lines that hold CREDENTIAL_REVEAL = 2'

# --- 9A/H-19
can df <<'EOF'
       Avail    1B-blocks
214748364800 500000000000
EOF
can timedatectl <<'EOF'
yes
EOF
collect c19b "$SEAM" collect-h19.sh --before --evidence "$EVID" --data-dir /srv/dems/data
std c19b 9A/H-19 h19-run1-before.txt
expect 'c19b: free space of the evidence disk and the clock state'' (1 of 2)' has c19b '214748364800 bytes free of 500000000000 (200.0 GiB free)'
expect 'c19b: free space of the evidence disk and the clock state'' (2 of 2)' has c19b 'output  | yes'
collect c19s "$SEAM" collect-h19.sh --session S4 --evidence "$EVID" --worker-log "$RUN/worker.jsonl" --core-log "$RUN/core.log" --data-dir /srv/dems/data
std c19s 9A/H-19 h19-run1-session-S4.txt 5
expect 'c19s: the length of the session, the re-timed packets per camera, the faults'' (1 of 3)' has c19s 'length of the session by the worker: 300 s (5.0 minutes)'
expect 'c19s: the length of the session, the re-timed packets per camera, the faults'' (2 of 3)' has c19s 'retimed=3'
expect 'c19s: the length of the session, the re-timed packets per camera, the faults'' (3 of 3)' has c19s 'lines that hold CAPTURE_FAULT = 1'

printf '%s\n' '--- 6. the record writer: one line per check'
rec() { # rec <name> <seam> <argument>...
  local name=$1 seam=$2
  shift 2
  collect "$name" "$seam" record-line.sh "$@"
}
rec w0 "$RUN/drybin" --dry --check 9A/H-27 --run 1 --result PASS --operation none --recording - --measured 'findings 0 in 6 of 6' --bound fixed --evidence-file h27-run1.txt --role USER
expect 'record writer: --dry prints the line, writes nothing, starts nothing'' (1 of 4)' [ "$(code_of w0)" = 0 ]
expect 'record writer: --dry prints the line, writes nothing, starts nothing'' (2 of 4)' has w0 '9A/H-27 | 1 | PASS | none | - | findings 0 in 6 of 6 | fixed | h27-run1.txt (USER) | -'
expect 'record writer: --dry prints the line, writes nothing, starts nothing'' (3 of 4)' [ ! -e "$EVID/result-record.txt" ]
expect 'record writer: --dry prints the line, writes nothing, starts nothing'' (4 of 4)' [ ! -s "$RUN/out/w0.log" ]
rec w1 "$RUN/notubuntu" --evidence "$EVID" --check 9A/H-27 --run 1 --result PASS --operation none --recording - --measured x --bound fixed --evidence-file - --role USER
expect 'record writer: refused off Ubuntu 24.04 with exit code 3, nothing written'' (1 of 2)' [ "$(code_of w1)" = 3 ]
expect 'record writer: refused off Ubuntu 24.04 with exit code 3, nothing written'' (2 of 2)' [ ! -e "$EVID/result-record.txt" ]
ORDER='27 01 02 24 03 04 16 05 25 06 07 08 12 13 15 14 10 23 17 21 09 26 18 20 22 11 19'
for n in $ORDER; do
  rec "w$n" "$SEAM" --evidence "$EVID" --check "9A/H-$n" --run 1 --result NOT-RUN --operation none --recording - --measured - --bound - --evidence-file - --role USER --note 'not run: test of the writer'
done
expect 'record writer: 27 calls, 27 lines, one per check, each check once'' (1 of 2)' [ "$(grep -c '^9A/H-' "$EVID/result-record.txt")" = 27 ]
expect 'record writer: 27 calls, 27 lines, one per check, each check once'' (2 of 2)' [ "$(grep -o '^9A/H-[0-9][0-9]' "$EVID/result-record.txt" | sort -u | wc -l | tr -d ' ')" = 27 ]
expect 'record writer: every line has the nine fields of chapter 1, section 9.1' [ "$(grep '^9A/H-' "$EVID/result-record.txt" | awk -F' [|] ' 'NF != 9' | wc -l | tr -d ' ')" = 0 ]
expect 'record writer: the result is exactly PASS, FAIL or NOT RUN' [ "$(grep '^9A/H-' "$EVID/result-record.txt" | awk -F' [|] ' '$3 !~ /^(PASS|FAIL|NOT RUN)$/' | wc -l | tr -d ' ')" = 0 ]
rec wdup "$SEAM" --evidence "$EVID" --check 9A/H-17 --run 1 --result PASS --operation REAL_PRODUCTION --recording S1 --measured 'sealed and verified: 1' --bound fixed --evidence-file h17-run1-sealed-S1.txt --role OPER
expect 'record writer: a second line for the same check and run is refused; the earlier line is kept'' (1 of 2)' [ "$(code_of wdup)" = 2 ]
expect 'record writer: a second line for the same check and run is refused; the earlier line is kept'' (2 of 2)' [ "$(grep -c '^9A/H-17 ' "$EVID/result-record.txt")" = 1 ]
rec wrun2 "$SEAM" --evidence "$EVID" --check 9A/H-17 --run 2 --result PASS --operation REAL_PRODUCTION --recording S1 --measured 'sealed and verified: 1' --bound fixed --evidence-file h17-run1-sealed-S1.txt --role OPER
expect 'record writer: the repeat is a new line with the next run number'' (1 of 2)' [ "$(code_of wrun2)" = 0 ]
expect 'record writer: the repeat is a new line with the next run number'' (2 of 2)' [ "$(grep -c '^9A/H-17 ' "$EVID/result-record.txt")" = 2 ]
rec wlist "$SEAM" --evidence "$EVID" --list
expect 'record writer: --list prints the checks in the order of the run and counts the missing ones'' (1 of 2)' [ "$(sed -n 2p "$RUN/out/wlist.txt" | cut -c1-7)" = '9A/H-27' ]
expect 'record writer: --list prints the checks in the order of the run and counts the missing ones'' (2 of 2)' has wlist 'lines in the record: 28; checks without a line: 0 of 27'
before=$(shasum -a 256 "$EVID/result-record.txt")
nope() { # nope <name> <description> <argument>...: must be refused, the record unchanged
  local name=$1 what=$2
  shift 2
  rec "$name" "$SEAM" --evidence "$EVID" "$@"
  expect "record writer refuses: $what" [ "$(code_of "$name")" = 2 ]
}
BASE='--run 3 --operation REAL_PRODUCTION --recording S1 --bound fixed --evidence-file - --role USER'
# shellcheck disable=SC2086
nope n1 'a FAIL without a reason' --check 9A/H-17 --result FAIL --measured x $BASE
# shellcheck disable=SC2086
nope n2 'a result that is not PASS, FAIL or NOT RUN' --check 9A/H-17 --result PARTIAL --measured x --note y $BASE
# shellcheck disable=SC2086
nope n3 'a network address in a field' --check 9A/H-17 --result FAIL --measured x --note 'camera at 192.168.50.20 lost' $BASE
# shellcheck disable=SC2086
nope n4 'a stream address in a field' --check 9A/H-17 --result FAIL --measured x --note 'rtsp://camera/stream refused' $BASE
# shellcheck disable=SC2086
nope n5 'a password in a field' --check 9A/H-17 --result FAIL --measured x --note "password: $PLANTED_PASSWORD" $BASE
# shellcheck disable=SC2086
nope n6 'a hardware address in a field' --check 9A/H-14 --result PASS --measured "$PLANTED_MAC" $BASE
# shellcheck disable=SC2086
nope n7 'a field separator or a shell character in a field' --check 9A/H-17 --result FAIL --measured 'a | b' --note 'x' $BASE
# shellcheck disable=SC2086
nope n8 'a check outside 9A/H-01 to 9A/H-27' --check 9A/H-28 --result PASS --measured x $BASE
# shellcheck disable=SC2086
nope n9 'an evidence file that is not in the evidence folder' --check 9A/H-17 --run 4 --result PASS --operation none --recording - --measured x --bound fixed --evidence-file h99-missing.txt --role USER
# shellcheck disable=SC2086
nope n10 'a name where a role belongs' --check 9A/H-17 --run 4 --result PASS --operation none --recording - --measured x --bound fixed --evidence-file - --role Budi
# shellcheck disable=SC2086
nope n11 'an option that would take a password' --check 9A/H-17 --result PASS --measured x --password x $BASE
expect 'record writer: the record is unchanged after the eleven refusals' [ "$(shasum -a 256 "$EVID/result-record.txt")" = "$before" ]
expect 'record writer: it started no program in any call' [ -z "$(cat "$RUN"/out/w*.log "$RUN"/out/n*.log)" ]

printf '%s\n' '--- 7. nothing was written outside the evidence folder; nothing in the package changed'
manifest >"$RUN/manifest.after"
expect 'files changed under scripts/hardware-acceptance/: 0 (checksums before and after are equal)' cmp -s "$RUN/manifest.before" "$RUN/manifest.after"
expect 'the working folder of the runs is empty' empty_dir "$RUN/cwd"
expect 'the home folder of the runs is empty' empty_dir "$RUN/home"
expect 'the temporary folder handed to the collectors is empty' empty_dir "$RUN/tmp"
expect 'the evidence folder holds only h<NN>-run<k>...txt files and the record' [ -z "$(ls -A "$EVID" | grep -vE '^(h[0-9]{2}-run[0-9]+(-[A-Za-z0-9-]+)?|result-record)\.txt$' || :)" ]
expect 'the planted password, token and hardware address are in no evidence file' [ -z "$(grep -rliE -- "$PLANTED_PASSWORD|$PLANTED_TOKEN|$PLANTED_MAC" "$EVID" || :)" ]
uncan
scan=0
node "$HERE/../secret-scan/count-only.mjs" "$EVID" >"$RUN/out/scan.txt" 2>&1 || scan=$?
expect 'the product'"'"'s count-only scan finds no credential form in the evidence folder (exit 0, TOTAL: 0)' [ "$scan" = 0 ]
expect 'no tool that a collector must never start was recorded in the whole run' [ -z "$(grep -E "$NEVER_RE" "$LOG" || :)" ]

printf '%s\n' '--- 8. shellcheck'
if command -v shellcheck >/dev/null 2>&1; then
  # shellcheck disable=SC2086
  if (cd "$HERE" && shellcheck -x -s bash $COLLECTORS record-line.sh test_hw_collectors_camera.sh); then
    ok 'shellcheck reports nothing'
  else
    bad 'shellcheck reports nothing'
  fi
else
  printf 'SKIPPED shellcheck is not installed on this machine: not run\n'
fi

printf '\nRESULT: %s passed, %s failed (camera and session group, record writer; nothing here is proven on a host)\n' "$PASSED" "$FAILED"
[ "$FAILED" = 0 ]
