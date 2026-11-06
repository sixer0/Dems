# Gate G1: host profile (row 46; AC1, AC2, AC7 pre-boot)

- Verifier: `verifier` agent, read-only. Nothing was written, started, stopped, enabled or reloaded on the host. The only side effect was the planned HOST-25 counter increment (one rejected loopback connection).
- Host: .73 (`ssh dems`). Re-run started 2026-10-22 22:20:41 WIB.
- Definition: `masterplan/02_plan.md:1114-1116` (row 46). Blocks: Block P `02_plan.md:86-99`, Block E `02_plan.md:101-110`. HOST items: `scripts/host/HOST-PROFILE-UBUNTU-24.04.md:50-158`. APP matrix: `research/03_analysis_applicability.md:62-124` (56 lines; PD-11-01..09). AC text: `identification/01_translated.md:57,58,63` and `masterplan/01_specs.md:235,236,241`.
- Decisions applied: D33 (3702 on enp4s0 and wlp3s0; IPV6=yes, so 4 rules), D34 (PGDG key checked by full fingerprint), D35 (row 36 yes), D36 (the two older SSH rules kept by the user's choice), D12 U-RF8/U-RF9/U-RF10.
- Secrets: no secret was read. `pg.env` was read for key names only (`cut -d= -f1`). From `core.env`, only the key names and the six path or mode keys were printed: none of these holds a secret, and row 42 records that the file holds no secret.

## 1. Read-only re-runs (fresh outputs)

### 1.1 Block P
```
wifi_fault_lines=0
watchdog_actions_15min=0
watchdog_timer=active
flag=root:root 644
ntp=yes
root_used_pct=9
```
Result: PASS. Every value is as expected. The flag reads `root:root 644`, as required from row 123 onward. `ntp=yes` is the value row 47 needs.

### 1.2 Block E
```
B=/home/gsp-dems/dems-host-baseline-20261022
docker_du_equal
backup_ok
```
Result: PASS. Nothing else was printed.

### 1.3 Row 34 checks (camera port)
```
192.168.100.254/24
1
0
enp4s0 / manual / (empty gateway) / (empty DNS) / yes / ignore
default via 192.168.0.1 dev wlp3s0 proto dhcp src 192.168.0.73 metric 600
```
Result: PASS. The values match the row 34 Expected line (`02_plan.md:634`).

### 1.4 Row 36 VERIFY lines (ufw)
```
dems-ufw-revert.timer: inactive
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)
n3702=4  n3702_enp4s0=2  n3702_wlp3s0=2
[ 1] 22/tcp                     ALLOW IN    Anywhere
[ 2] OpenSSH                    ALLOW IN    Anywhere
[ 3] 22/tcp on wlp3s0           ALLOW IN    Anywhere        # DEMS admin SSH on Wi-Fi (D5)
[ 4] Anywhere on enp4s0         ALLOW IN    3702/udp        # DEMS camera search answers
[ 5] Anywhere on wlp3s0         ALLOW IN    3702/udp        # DEMS camera search answers (Wi-Fi, D33)
[ 6]-[10] the v6 twins of [1]-[5]
IPV6=yes  DEFAULT_INPUT_POLICY="DROP"  DEFAULT_OUTPUT_POLICY="ACCEPT"  DEFAULT_FORWARD_POLICY="DROP"
ENABLED=yes ; ufw.service enabled, active
iptables -P FORWARD DROP ; ip6tables -P FORWARD DROP ; iptables -P INPUT DROP
```
Result: PASS on intent. Two notes:
- The 3702 count is `4`: 2 on `enp4s0` and 2 on `wlp3s0`, which is the D33 figure doubled for `IPV6=yes`. No other rule names 3702.
- The routed policy prints `disabled (routed)` instead of `deny (routed)`. The cause is in ufw 0.36.2-6, `/usr/lib/python3/dist-packages/ufw/backend.py:135-166` (`_get_default_policy`). When `check_forward` is set, the function returns `"disabled"` if no `net.ipv4.ip_forward` or IPv6 forwarding sysctl is 1. The stored policy is deny: `DEFAULT_FORWARD_POLICY="DROP"`, and the FORWARD chain is `-P FORWARD DROP` for both IPv4 and IPv6. So ufw can only print `deny (routed)` when forwarding is on, and forwarding on would break HOST-20. The literal string in HOST-22 and row 36 can never appear on a host that is correct. This is recorded as issue L1, not as a failure.

### 1.5 Row 40 listener checks
```
127.0.0.1:4432            (sport 4432: one line)
l5432=0
postgres 700              (socket /var/run/postgresql/.s.PGSQL.4432)
postgres 700              (data dir /var/lib/postgresql/18/main)
127.0.0.1                 (SHOW listen_addresses)
18.6 (Ubuntu 18.6-1.pgdg24.04+2)
local   all         postgres                          peer
host    postgres    dems_owner             127.0.0.1/32  scram-sha-256
host    dems_demo   dems_owner,dems_app    127.0.0.1/32  scram-sha-256
postgres:postgres 640     (pg_hba.conf)
start_auto=1 ; ufw4432=0 ; postgresql.service enabled ; postgresql@18-main active
18  main    4432 online postgres /var/lib/postgresql/18/main ...
```
All listeners on the host (`ss -H -ltnup`):
```
udp 0.0.0.0:43564, 0.0.0.0:5353, [::]:5353, [::]:39243  avahi-daemon
udp/tcp 127.0.0.53%lo:53, 127.0.0.54:53                  systemd-resolve
tcp 127.0.0.1:631, [::1]:631                             cupsd
tcp 0.0.0.0:22, [::]:22                                  sshd
tcp 127.0.0.1:5173                                       node (dems-console)
tcp 127.0.0.1:4432                                       postgres
```
Result: PASS. Both DEMS listeners (4432 and 5173) are on loopback only. Nothing listens on `:5432`. The Core (4420) is not running (`dems-core.service` is inactive and disabled; R18-5). The avahi, cups and sshd listeners are operating-system services that were there before this task; none of them is a DEMS port.

### 1.6 Row 45 absence checks
```
absence_checked            (no PRESENT line)
0                          (dems-core-netalias* unit files)
/etc/sudoers:0
/etc/sudoers.d/README:0
/etc/sudoers.d/90-gsp-dems:0
```
Result: PASS.

### 1.7 HOST-25 counter test with ufw active (H4; SEC §2.4)
```
Status: active
dems-loopback-rule.service: active
oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != 997 counter packets 1 bytes 60 reject with tcp reset
rule_count=1   uid_dems_core=997
attempt_rc=1   (sudo -u gsp-dems timeout 2 bash -c '</dev/tcp/127.0.0.1/8554' refused)
counter_before=1 counter_after=2
```
Result: PASS. The counter rose while ufw was active. nft prints the user as uid `997`, which is `dems-core`. Row 35 recorded the same thing: the row's regex is marked (unverified), and the rule is the one specified.

## 2. AC1 matrix: HOST-01..HOST-56

Key: PASS = the took-effect check prints the profile's value, or the value of the recorded deviation. N/A = not applicable on this bench, or due at a later row, with the reason given. FAIL = the check prints something else and no decision covers it. "Art." = the row artifact. "Now" = this re-run.

| Item | APP class / rows | Result | Evidence |
|---|---|---|---|
| HOST-01 | applicable / 21 | PASS | Now: `Ubuntu 24.04.1 LTS`, `x86_64`. Art. `implementation/01_preflight.md:7` |
| HOST-02 | applicable / 21 | PASS | Now: `0 unit files listed.`; `No such file` x `2` |
| HOST-03 | applicable / 21 | **FAIL** | Now: `root sync gsp-dems postgres`. Expected `root`, `sync` and the one administrator only. `getent passwd postgres` → `postgres:x:123:124:PostgreSQL administrator,,,:/var/lib/postgresql:/bin/bash`. The account was created by the PGDG install of row 39, after row 21 had passed (`01_preflight.md:9`). No decision or artifact records it (grep of the task folder for HOST-03 and postgres/bash returns nothing). Routed to row 39 (see section 6) |
| HOST-04 | deviation F-S1 / 22 | PASS | Now: `dems-core:x:997:983::/nonexistent:/usr/sbin/nologin` (and `dems-console` the same) |
| HOST-05 | deviation PD-11-01 / 22,26,27 | PASS | Now: every `namei -l .../build/capture-worker` component is `root root`, with no g/o `w`. A scan of `/opt/dems/core` (excluding `.data`, `logs`, `.vite`, the three paths PD-11-01 permits) finds 0 non-symlink entries that are non-root or g/o-writable. All 49 entries found are symlinks. `logs` is `dems-core 700` and `.vite` is `dems-console 700` |
| HOST-06 | deviation W1 / PD-11-02 / 22 | PASS | Now: `.data` and `.data/media/sessions` are `dems-core dems-core 700`. `namei`: `/`, `opt`, `dems`, `core` are `root root drwxr-xr-x`. The `CAPTURE_EVIDENCE_STORE_UNUSABLE` part needs a real-capture start (row 58) |
| HOST-07 | applicable (partial) / 22,58 | PASS (partial); rest N/A | Now: `ext4 /dev/nvme0n1p2`. N/A: `NO_HARD_LINKS`/`NO_SYNC` are read at the Core's start, row 58 |
| HOST-08 | partial / 58,59 | N/A | Reason: needs a running session (`<data-dir>/run` pipes); rows 58 and 59 |
| HOST-09 | deviation D12 U-RF8 / 25 | PASS (deviation) | Now: `v26.12.1`, `namei` all `root root`. `.node-version` reads `26.8.2`; 26.12.1 is the version D12 U-RF8 chose. Signature: art. `05_node.md:5-7` |
| HOST-10 | applicable / 24 | PASS | Now: `Status: install ok installed` x `6` |
| HOST-11 | applicable / 24 | PASS | Now: `package 'libavformat-dev' is not installed` |
| HOST-12 | applicable (U-RF9 LGPL) / 28 | PASS | Now: `ffmpeg version 9.0.2`; `libavformat    63.  1.102`; ` DE alsa` (D mark present). LGPL: art. `08_ffmpeg.md:6` |
| HOST-13 | applicable / 28 | PASS | Now: `libavformat.so.63 (libc6,x86-64) => /opt/dems/ffmpeg-9.0.2/lib/libavformat.so.63` |
| HOST-14 | deviation PD-11-03 / 29 | PASS | Now: `ldd capture-worker` → `/opt/dems/ffmpeg-9.0.2/lib/libavformat.so.63`, no `not found`. Build exit `0`: art. `09_capture_worker.md:3`. The start-time reasons are read at row 58 |
| HOST-15 | applicable / 30,31 | PASS | Now: `ldd capture-relay` → the pinned libavformat.so.63. Guard has `0` libav links (it is not FFmpeg-linked). Version lines: art. `10_relay.md:3`, `11_guard.md:3`. The Core-start comparison is at row 58 |
| HOST-16 | applicable / 31,42 | PASS | Now: `namei -l /opt/dems/ffmpeg-9.0.2/bin/ffmpeg` all `root root`, no g/o `w`. `core.env` holds `DEMS_CAPTURE_AUDIO_HELPER=/opt/dems/ffmpeg-9.0.2/bin/ffmpeg` |
| HOST-17 | applicable / 21 | PASS (recorded) | Now: the longest `comm` is 37 overall but `15` without kernel threads (ppid 2; e.g. `kworker/R-sync_wq`). `args` lines starting with `/`: `100`. Art. `01_preflight.md:10` |
| HOST-18 | applicable / 24 | PASS | Now: `iputils-arping: /usr/bin/arping`; `arping` not installed; list line `/usr/bin/arping`; `arping_md5_equal`; `dpkg --verify` `0` lines; `root 755 /usr/sbin/ip`, `root 755 /usr/bin/arping` |
| HOST-19 | deviation of form D8 A8 / 34 | PASS | Section 1.3 |
| HOST-20 | applicable / 33 | PASS | Now: `0`, `0`, enp4s0 `0` |
| HOST-21 | applicable / 21 | PASS | Now: `0` `ii` lines |
| HOST-22 | applicable (D5, D8 A9) / 36 | PASS (literal-string note L1) | Section 1.4: `Status: active`, `deny (incoming)`, `allow (outgoing)`. Routed is shown as `disabled` because forwarding is off. Stored policy `DROP`; `-P FORWARD DROP` for v4 and v6 |
| HOST-23 | applicable, D33 M-6 / 36,72 | PASS (rule part); search part N/A | Section 1.4: 3702 rules on `enp4s0` and `wlp3s0` only, 4 with v6. N/A: "the search in the web console lists at least 1 camera" needs a running Core (rows 58/72) |
| HOST-24 | applicable, PD-11-04 / 59,72 | PASS (pre-boot part); rest N/A | Now: no ufw `ALLOW` naming 4420-4423, 4432 or 5173 (`0`). Listeners `127.0.0.1:4432` and `127.0.0.1:5173` only. N/A: the `dems-core` listeners (Core not started; row 59) and the off-host probes (row 72) |
| HOST-25 | applicable / 35 | PASS | Section 1.7 (ufw active): counter 1 → 2 |
| HOST-26 | applicable W13 / 37 | PASS | Now: `dems-core audio dems-netalias`; `alsa-utils: /usr/bin/arecord`; `arecord -l` as dems-core lists BOMGE `1` |
| HOST-27 | applicable W13, partial / 37,125-127 | PASS (partial) | Now: `lsusb` 3347:2430 `1`; ` 1 [AUDIO ]: USB-Audio - BOMGE USB AUDIO`. Capture is at rows 125-127 |
| HOST-28 | applicable W13, PD-11-05 / 37 | PASS (scoped check) | Now: seat0 sessions `1`, so the "no session running" precondition is not met (art. `17_audio_access.md:6` records the same). `fuser -v /dev/snd/pcmC*D*c` printed `0` lines: no process holds any capture node, the USB card (`pcmC1D0c`, by-id `usb-HANMUS_BOMGE_USB_AUDIO-00`) included. Shared-capture opening is 9A/H-08 (out of scope) |
| HOST-29 | applicable / 38 | PASS | Now: `masked masked masked masked` |
| HOST-30 | N/A | N/A | Reason (APP): no lid. Now: no `/proc/acpi/button/lid` node; no file F |
| HOST-31 | applicable / 38 | PASS | Block P `ntp=yes` |
| HOST-32 | applicable / 38,43 | PASS | Now: `systemd-time-wait-sync.service` `enabled`; dems-core `After=` holds `time-sync.target` |
| HOST-33 | deviation D8 OI-5 / PD-11-06 / 43,58 | PASS (form confirmed at 58) | Now: `systemd-analyze verify` `0` lines; `root root 644` |
| HOST-34 | deviation W1 / F-S5 / PD-11-07 / 42,57 | PASS (SIMULATED form) | Now: `/etc/dems` `root root 755`; `core.env` `root dems-core 640`; dev-switch grep `0`; `DEMS_PG_`/`PG` keys `0`. Keys: DEMS_CORE_PORT, DEMS_CAPTURE_MODE (`simulated`), DEMS_MEDIA_DIR, DEMS_CAPTURE_WORKER/RELAY/GUARD/AUDIO_HELPER. The REAL form is at row 57 |
| HOST-35 | applicable, PD-11-08 / 59 | PASS (unit part); `/proc` N/A | Now: `LimitCORE=0`. N/A: the `/proc/<pid>/limits` reading on both pids needs a running Core (row 59) |
| HOST-36 | applicable, PD-11-08 / 58,59 | PASS (static part); `/proc` N/A | Now: `ExecStart=/opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/tsx/dist/cli.mjs src/index.ts` has no `--report/--diagnostic/--heap/--inspect`; `NODE_OPTIONS` not in `core.env` (`0`); no `Environment=` line in the unit. N/A: `/proc` cmdline/environ at rows 58/59 |
| HOST-37 | applicable / 33 | PASS (pre-existing crash file recorded) | Now: apport `disabled`; `kernel.core_pattern` `\|/bin/false` (file C is the only source); `fs.suid_dumpable` `0`. `/var/crash` holds 1 file, `_usr_libexec_tracker-extract-3.1000.crash`, dated 2026-10-21 16:14:39. That is before the task, and it is not a Core image. Row 33 Expected (`02_plan.md:621`) says "existing crash files are recorded, not deleted"; art. `13_sysctl_crash.md:4` |
| HOST-38 | applicable / 43,59 | PASS (unit part); `/proc` N/A | Now: `NoNewPrivileges=yes`. `/proc` at row 59 |
| HOST-39 | partial / 43,59 | PASS (unit part); `/proc` N/A | Now: `CapabilityBoundingSet=`, `AmbientCapabilities=` (empty in the unit file and in `systemctl show`). `/proc` Cap lines at row 59 |
| HOST-40 | applicable / 43,59 | PASS (unit part); `/proc` N/A | Now: `SupplementaryGroups=audio dems-netalias`; groups exist (`audio:x:29`, `dems-netalias:x:981`). `/proc` Groups at row 59 |
| HOST-41 | applicable / 43 | PASS (Requires part); stop-propagation N/A | Now: `Requires=... dems-loopback-rule.service`; `After=` holds it too. N/A: the "stop the rule, Core stops" test would change state and needs a running Core (row 58 / 9A/H-04) |
| HOST-42 | applicable / 43,59 | PASS (unit part); `/proc` N/A | Now: `UMask=0077`. `/proc` Umask at row 59 |
| HOST-43 | applicable / 23 | PASS | Now: `dems-netalias:x:981:dems-core` |
| HOST-44 | N/A / 45 | N/A | Reason: helper absent by design (C-14). Absence verified, section 1.6 |
| HOST-45 | N/A / 45 | N/A | Reason: helper absent; `/usr/local/sbin/dems-core-netalias` absent (section 1.6) |
| HOST-46 | N/A / 45 | N/A | Reason: helper absent; `/etc/dems/netalias-interface` absent (section 1.6). Boot `NOT_ASKED` is read at rows 48/58 |
| HOST-47 | applicable / 45 | PASS | Section 1.6: every file `:0` |
| HOST-48 | deviation D8 F7, partial / 62-65 | N/A | Reason: camera activation is an attended step at rows 62-65 |
| HOST-49 | partial / 58 | N/A | Reason: needs the Core's start (row 58) |
| HOST-50 | applicable, choice B / 39 | PASS | Now: `psql (PostgreSQL) 18.6 (Ubuntu 18.6-1.pgdg24.04+2)`; held `2`. Key by full fingerprint `B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8` (D34; art. `19_pg_install.md:5`) |
| HOST-51 | applicable, U-RF10 / 39 | PASS (version recorded) | Now: `SHOW server_version` `18.6 (Ubuntu 18.6-1.pgdg24.04+2)`. 18.6 rather than 18.4 per D12 U-RF10 "PostgreSQL minor per row 13 spec"; release-note review in art. `19_pg_install.md:4` |
| HOST-52 | applicable / 40 | PASS | Now: `/var/lib/postgresql/18/main` `postgres 700`, outside `/opt/dems/core` |
| HOST-53 | deviation W2 / PD-11-09 / 40 | PASS | Section 1.5: `127.0.0.1:4432` only; ufw lines naming 4432 `0` |
| HOST-54 | deviation W1/W3 / PD-11-07 / 41 | PASS | Now: `dems_app\|f\|f\|f\|t` (not superuser), `dems_owner\|f\|f\|t\|t`; public tables owned by `dems_app` `0`; `pg.env` `dems-core 600`, keys DEMS_PG_HOST/PORT/DATABASE/APP_ROLE/APP_PASSWORD; `owner_file_absent` |
| HOST-55 | applicable / 44 | PASS | Now (read-only SQL): `dems_demo\|dems_owner`; `drizzle.__drizzle_migrations` count `34`; `schema_meta` `t\|15\|dbc-16`. `db:status` exit 0 and its OK line: art. `24_database_seed.md:5` |
| HOST-56 | applicable / 43,71 | PASS (ordering part); enable/boot N/A | Now: `After=`/`Wants=` hold `postgresql@18-main.service`. N/A: `dems-core.service` is `disabled` until row 58 (R18-5); "active after a restart" is checked at row 71 |

Count: 56 items. FAIL 1 (HOST-03). N/A in full 7 (HOST-08, -30, -44, -45, -46, -48, -49), each with its reason. The other 48 PASS; where a check has a later-row part (/proc readings, Core start, off-host probes), that part is marked N/A in the item's row.

## 3. AC2 evidence (rows 40, 44)

| Part | Evidence | Result |
|---|---|---|
| PostgreSQL on `127.0.0.1` only | `ss -H -ltn 'sport = :4432'` → one line `127.0.0.1:4432`; `:5432` `0`; `SHOW listen_addresses` `127.0.0.1` (section 1.5); art. `20_pg_loopback.md:6` | PASS |
| `db:status` exit 0 | Art. `24_database_seed.md:5`: status `OK: dems_demo is at the schema version this code expects and the ledger matches the files`. Not re-run here because `db:status` runs project code; the read-only SQL below confirms its figures | PASS |
| Schema version recorded | Now: `schema_meta` `t\|15\|dbc-16`; ledger `34`; art. `24_database_seed.md:6` `DB_SCHEMA_VERSION = 15`, `34`/`34` | PASS |

AC2: PASS.

## 4. AC7 pre-boot (ufw)

| Part | Evidence | Result |
|---|---|---|
| ufw active | `Status: active`, `ENABLED=yes`, `ufw.service` enabled and active; revert timer `inactive` (section 1.4) | PASS |
| Defaults | INPUT DROP, OUTPUT ACCEPT, FORWARD DROP (v4/v6). `disabled (routed)` is the ufw display when forwarding is off (L1) | PASS |
| SSH only on the room network | Rule [3] `22/tcp on wlp3s0` as designed. **Recorded deviation D36:** the older user rules [1] `22/tcp` and [2] `OpenSSH` (and v6 [6], [7]) admit SSH on every interface, the camera port `enp4s0` included. `sshd` listens on `0.0.0.0:22` and `[::]:22`. The user kept them ("Biarkan", `decisions.md:54`). Per D36 this does not fail the gate. It is stated here so the reboot and later gates know that SSH is reachable from the camera switch | PASS with recorded deviation D36 |
| No DEMS port reachable from Wi-Fi (pre-boot part) | DEMS listeners: `127.0.0.1:4432`, `127.0.0.1:5173` only. No ufw rule names 4420-4423, 4432 or 5173. Core not running. The off-host probes are at row 72 | PASS (pre-boot); probes N/A until 72 |
| 3702 admit (D33 M-6) | 4 rules: 2 on enp4s0, 2 on wlp3s0, no other 3702 rule | PASS |

AC7 pre-boot: PASS, with deviation D36 stated.

## 5. Issues found

| Sev | ID | Finding | Evidence |
|---|---|---|---|
| Medium | M1 | HOST-03 check fails. The `postgres` account has `/bin/bash`, so it counts as a second interactive account beside `gsp-dems`. Row 39 introduced it after row 21 passed, and no decision records it. Its password and lock state were not read (`/etc/shadow` is off-limits), so whether it can log in by password is **unknown**. | `awk -F: '$7 !~ /nologin$/ && $7 !~ /false$/' /etc/passwd` → `root sync gsp-dems postgres`; `getent passwd postgres` (section 2) |
| Low | L1 | The HOST-22 and row 36 VERIFY expected string `deny (routed)` cannot appear while HOST-20 holds. ufw prints `disabled` whenever forwarding is off. The intent is met. The profile and runbook text need a correction, and the controller should record the reading. | `ufw/backend.py:135-166`; `iptables -S FORWARD` → `-P FORWARD DROP` |
| Low | L2 | Row 35 regex `skuid != "?dems-core"?` does not match the nft output (uid `997`). This repeats the row 35 finding; the runbook correction is still open. | Section 1.7 |
| Info | I1 | D36 deviation: SSH is admitted on the camera port. Accepted by the user. | Section 4 |

## 6. Routed failures and remediation notes (no fix applied)

| Item | Route to | Options for the controller to present to the user (user's call per HOST-03 "other accounts are removed or locked by the user" and the row 21 STOP, `02_plan.md:278`) |
|---|---|---|
| HOST-03 | Row 39 (PostgreSQL install; the account came with the PGDG package), re-checked by the row 21 HOST-03 command | (a) Record a decision: `postgres` is a package system account (uid 123), accepted as a recorded deviation of HOST-03. Optionally confirm its password is locked with a status-only reading the user approves. (b) Set its shell to `/usr/sbin/nologin`. This must be checked first against `postgresql-common` maintenance scripts that use `su postgres`; the runbook's own `sudo -u postgres psql` calls do not need a login shell (hypothesis, not tested). After either choice, re-run the HOST-03 line and update G1. |

L1 and L2 are runbook and profile text corrections. They belong to the host-docs rows (row 65/66 family) and do not block G1.

## 7. Next steps

1. The controller presents M1 to the user (AskUserQuestion) and records the answer in `decisions/decisions.md`.
2. If the user takes (a), G1 can be re-issued as PASS from this file plus the decision id, with no re-run needed. If the user takes (b), re-run the HOST-03 line only.
3. Row 47 (reboot) stays held until G1 passes (D34 (3): "reboot jika G1 lolos").

G1: FAIL (HOST-03)

## 8. Re-issue after the user's ruling (controller, 2026-10-22)

- Before the ruling (read-only, status words only): no `su postgres` in `/usr/share/postgresql-common`, `/usr/bin/pg_*`, `/usr/sbin/pg_*` or the postgresql maintainer scripts (grep printed nothing); `passwd -S postgres` -> `postgres L` (password locked).
- User ruling D37: option (b), "Ubah shell ke nologin (Recommended)".
- Applied: `usermod -s /usr/sbin/nologin postgres` -> `getent passwd postgres` shell `/usr/sbin/nologin`.
- HOST-03 re-run (row 21 line): `root`, `sync`, `gsp-dems` -> PASS.
- PostgreSQL after the change: `postgresql@18-main.service` `active`; `sudo -u postgres psql -p 4432 -c 'SELECT 1'` -> `1`; `pg_lsclusters` `18 main 4432 online`. The reboot of row 47 also proves the cluster starts with the nologin shell (row 47 VERIFY lists postgresql@18-main).
- Every other item stands as recorded above (48 PASS, 7 N/A with reasons; AC2 PASS; AC7 PASS with the D36 deviation stated). L1, L2 are non-blocking text corrections.

G1: PASS (re-issued after D37; HOST-03 PASS)
