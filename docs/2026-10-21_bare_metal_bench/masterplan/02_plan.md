---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 18
type: implementation-plan (install command runbook, rows 20-79 and 122-128)
narrative_tier: 1
based_on: masterplan/01_specs.md (row 17, the consolidated install spec; it wins over the delta files)
inputs: masterplan/01_specs_register.md (names ONLY from here, incl. section 11), masterplan/01_specs_database.md (DB), masterplan/01_specs_security.md (SEC), masterplan/01_specs_service.md (SVC), research/03_analysis_impact.md (IMP), research/03_analysis_applicability.md (APP), research/02_collection_{node,ffmpeg,pgdg}.md, masterplan/01_specs_rflex.md (SPEC-RF), masterplan/01_specs_rflex_host_docs.md (HD), decisions.md D8-D16, scripts/host/HOST-PROFILE-UBUNTU-24.04.md (HP), scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md (IN), scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md (HWA1), HW-ACCEPTANCE-3-NETWORK-CAMERAS-SESSION.md (HWA3)
confidence: MEDIUM. Every command is copied from a cited spec section with the row-17 resolutions applied, or is marked "(unverified)". No command in this file has run on .73.
secret_values_in_this_file: none
last_updated: 2026-10-22 17:23
---

# Install command runbook for host .73 (row 18)

## 0. How to read this file

### 0.1 5W1H (Tier 1)

| W | Answer |
|---|---|
| What | The exact command runbook for install rows 20-79 and 122-128, **as those rows will be after the MINOR requests E-1..E-17 of `01_specs.md` §6**: per row the commands (Mac side and over SSH to .73, with `sudo` where needed), the files written with owner and mode, the expected output, the stop condition, and for every HIL row a hand-over in three parts (PREPARE / USER / VERIFY) |
| Who | Producer: data-analyst (row 18). Consumers: row 19 (task-architect refinement), the controller (hand-overs, locks, gates), executors of rows 20-79 and 122-128 (coder-execution, database-specialist, test-expert, verifier, security-review, senior-code-reviewer, data-analyst, document-writer). The user: every step marked USER, and the yes of rows 36, 47, 71 |
| When | Written 2026-10-22 after row 17. Applied only after gate G-RF (row 119) and row 121 (D10 ruling 3; RF-P1). Install order in section 2 |
| Where | Host `gsp-dems@192.168.0.73` (Ubuntu 24.04.1, one ext4 file system, Wi-Fi `wlp3s0` the only admin path, camera LAN `enp4s0` 192.168.100.254/24). Mac `192.168.0.14` for the forwards and Mac-side probes (register §5.1) |
| Why | Rows 20-79 and 122-128 are a provisional skeleton (02_structured.md §1.5). Row 17 settled the specs; this file turns them into one copy-ready sequence so that no executor re-derives a command from five delta files (01_specs.md §9 R-1, R-2) |
| How | Each row section copies the governing source cited in its header (`01_specs.md` SI-nn, then the delta section it names), applies the resolutions P-01..P-21 and C-1..C-20, and adds the checks. Commands not found in any source are marked **(unverified)**. Names come only from the install register (§11 included); R-FLEX names only from the R-FLEX register / SPEC-RF |
| Alternatives | Per row where a choice was made here (listed in section 6 as R18-n, for row 19) |
| Assumptions | (A1) D16 rulings as written; (A2) R-FLEX lands on its recommended path (no migration; 34 files / schema 15 / `dbc-16`); (A3) host state = row-6 survey + 02_/03_ host files; (A4) gate G-RF passed and row 121 placed the changed tree in `tree_staging_dir` |
| Gaps | Section 8 |

### 0.2 Status words used in this file

- **(unverified)**: the command or its exact output form was not found in a source of this task; the executor runs it and records what it printed. Most are tool behaviours (`gpgv` keyring form, `nmcli -g` field names, `loginctl` columns) that row 6 did not survey.
- **Source:** after a block names the spec section the block is copied from.
- **STOP** = end the row, write the state into the row's artifact, report `blocked` to the controller (IMP §5 convention). Never retry in a loop.

## 1. Conventions that hold for every row

### 1.1 SSH forms

| Use | Form (Mac side) |
|---|---|
| Agent call (every executor). Shell state does not persist between Bash calls, so each call defines the function first. LAN calls need the Bash sandbox disabled (02_structured.md §4) | `hssh() { ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 gsp-dems@192.168.0.73 "$@"; }` |
| Agent script block (no secret in the text; `set -x` is never used) | `hssh 'sudo -n bash -s' <<'EOF'` ... `EOF` (quoted delimiter: nothing is expanded on the Mac) |
| Fresh-session test (row 36 R7/R8; after reboots) | `ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -o BatchMode=yes -o ControlMaster=no -o ControlPath=none -o ConnectTimeout=15 gsp-dems@192.168.0.73 '<cmd>'` (SEC §2.2 R7) |
| USER terminal (HIL rows 54-57; never the agent) | `ssh -t -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes gsp-dems@192.168.0.73` in the user's own Mac terminal (D6, OI-1). No `script`, terminal recorder, `tmux pipe-pane` or screen share while typing (SEC S1; IN §2.5) |
| Console forward (rows 49-51, 66-69, 124-128) | `ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -o ExitOnForwardFailure=yes -N -L 127.0.0.1:5173:127.0.0.1:5173 gsp-dems@192.168.0.73`; browser at `http://127.0.0.1:5173` (never `localhost`) (01_specs.md C-9; register §11.3) |
| Camera-page forwards (rows 62-65) | `ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -o ExitOnForwardFailure=yes -N -L 127.0.0.1:18101:192.168.100.101:80 -L 127.0.0.1:18102:192.168.100.102:80 -L 127.0.0.1:18103:192.168.100.103:80 -L 127.0.0.1:18117:192.168.100.117:80 gsp-dems@192.168.0.73` (C-9; I-14) |

A dropped SSH call is retried once after 60 s, then the row reports `blocked` (driver_rules.md addendum). Never restart NetworkManager. Never touch PC 192.168.0.72.

### 1.2 Output rule (SI-00a, SI-00h)

Every check prints names, modes, owners, counts, exit codes, versions or public hashes only. No command reads a secret file's content: `pg.env`, `pg.owner.env`, `/etc/shadow` copies, `.data/signer/*.p8|*.wrap`, `.data/credential-store`, NM connection files, the Docker-era backups. A key-name listing (`cut -d= -f1`) is allowed. Values the user types (operator and camera passwords, attended-check value) never reach a file, argument or the agent.

Before reporting `complete`, each row runs the SEC §7 scan with the C-1 widened pattern over its own artifacts (Mac side):

```
cd /Users/gsp-budi/Documents/DEMS/docs/2026-10-21_bare_metal_bench
grep -rIlE \
  -e '-----BEGIN [A-Z ]*PRIVATE KEY-----' \
  -e '(PASSWORD|PASSWD|SECRET|TOKEN|PSK)[A-Z_]*[[:space:]]*[=:][[:space:]]*[^[:space:]<`|"'"'"']' \
  -e '[a-z][a-z0-9+.-]*://[^/[:space:]:@]+:[^/[:space:]@]+@' \
  -e '(^|[^A-Za-z0-9_-])[A-Za-z0-9_-]{43}([^A-Za-z0-9_-]|$)' \
  -e '(^|[[:space:]])psk[[:space:]]*[=:]' <own files>
```
Pass = no file listed. Source: SEC §7 with 01_specs.md C-1.

### 1.3 Whole-install bans (SI-00b, SI-00c; IMP R7, R8)

A command line that holds any of these is a STOP before it is sent:
- `apt-get purge`, `apt purge`, `dpkg -P`, `dpkg --purge`, `autoremove`, or the `docker` program;
- `rm`, `mv`, `chown`, `chmod`, `tar -x` or `rsync --delete` together with `/var/lib/docker`, `/var/lib/containerd`, `dems-backup-20261021`, `dems-change-backup-20261021.sql` or `DEMS-Linux-Docker-LCD-20261019`;
- `systemctl restart NetworkManager` (or `stop`/`reload` of it), `netplan apply`, `netplan try`;
- `chown -R` or `rm -rf` over `/opt/dems/core`, any copy with `--delete` into it, anything under `/opt/dems/core/.data` except the named writes of rows 22, 41, 44, 56 (via the command), 57.

Allowed read-only touches of the kept paths (IMP §4.2): `du -sb`, `sha256sum -c` inside `~/dems-backup-20261021`, `ls`, `stat`, `dpkg -l 'docker*' ...` (HOST-21).

Single-writer resources (02_structured.md §4): `apt-lock` (rows 24, 39), `heavy-host` (27, 28, 29, 30, 31; one at a time), `npm-lockfile` (27), `db` (40, 41, 44, 50-52, 55, 58, 66-69, 125-128), `core-unit` (48, 52, 58, 71), `user-terminal` (36, 47, 50, 51, 54-57, 62-69, 71, 125-128), `host-reboot` (47, 71).

### 1.4 Shared blocks

#### Block P: pre-row guards (run at the start of every host row; SI-00d, SI-00e, SI-00f; IMP R2, R3, R5, R6)

```
hssh 'sudo -n bash -s' <<'EOF'
echo "wifi_fault_lines=$(journalctl -b -k -g 'IO_PAGE_FAULT|failed to get tx report' --no-pager -q | wc -l)"
echo "watchdog_actions_15min=$(journalctl -t dems-wifi-watchdog --since -15min -g 'reload|reboot' --no-pager -q | wc -l)"
echo "watchdog_timer=$(systemctl is-active dems-wifi-watchdog.timer)"
echo "flag=$(stat -c '%U:%G %a' /etc/dems-wifi-watchdog.noreboot 2>/dev/null || echo absent)"
echo "ntp=$(timedatectl show -p NTPSynchronized --value)"
echo "root_used_pct=$(df --output=pcent / | tail -1 | tr -dc 0-9)"
EOF
```
Expected: `wifi_fault_lines=0`, `watchdog_actions_15min=0`, `watchdog_timer=active`; `flag=root:root 644` from row 123 onward (C-10: from row 22 onward); `ntp=yes` before rows 47, 48, 58, 62-65, 71, 125-128; `root_used_pct` not above 80 before rows 24, 27, 28, 44 and any recording (P-19).
STOP if any expected value differs for the row in question.

#### Block E: stage-end check of the kept data (IMP R7; run at the end of rows 20, 24, 31, 39, 44, 58, 71)

```
hssh 'sudo -n bash -s' <<'EOF'
B=$(ls -d /home/gsp-dems/dems-host-baseline-* | head -1)
du -sb /var/lib/docker /var/lib/containerd | diff -q - "$B"/docker_kept_du.txt && echo docker_du_equal
cd /home/gsp-dems/dems-backup-20261021 && sha256sum -c --quiet SHA256SUMS && echo backup_ok
EOF
```
Expected: `docker_du_equal` and `backup_ok`, nothing else. Any other line: STOP all rows, change nothing further, report to the user (IMP R7).

#### Block K: install backup (SI-29; IMP R8 with P-05, P-06; register §11.1 `install_backup_dir`). Core stopped. Taken inside rows 44, 57 and 71 as their first step (row-18 choice for E-12), and before any tree re-copy or rollback

```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
umask 077
test "$(systemctl is-active dems-core.service)" != active
K=/home/gsp-dems/dems-install-backup-$(date +%Y%m%d-%H%M)
test ! -e "$K"
install -d -m 0700 -o gsp-dems -g gsp-dems "$K"
tar -C /opt/dems/core --exclude=./.data/signer --numeric-owner -czf "$K"/data_without_signer.tar.gz ./.data
[ -e /etc/dems/core.env ] && cp -a /etc/dems/core.env "$K"/
if sudo -u postgres psql -X -At -p 4432 -d postgres -c "SELECT 1 FROM pg_database WHERE datname='dems_demo'" 2>/dev/null | grep -qx 1; then
  sudo -u postgres pg_dump -p 4432 -Fc dems_demo > "$K"/dems_demo.pgdump
  sudo -u postgres pg_dumpall -p 4432 --globals-only --no-role-passwords > "$K"/pg_globals.sql
fi
echo "signer_members=$(tar -tzf "$K"/data_without_signer.tar.gz | grep -c -E '(^|/)signer(/|$)' || true)"
(cd "$K" && sha256sum -- * > SHA256SUMS && sha256sum -c --quiet SHA256SUMS && echo sums_ok)
echo "backup_dir=$K"; ls -A "$K"; stat -c '%U:%G %a %n' "$K"
EOF
```
Expected: `signer_members=0`, `sums_ok`, the member list (`data_without_signer.tar.gz`, `core.env` when it exists, `dems_demo.pgdump` and `pg_globals.sql` when `dems_demo` exists, `SHA256SUMS`), `gsp-dems:gsp-dems 700 <dir>`. Before row 44 the database does not exist yet, so only the tar (and `core.env` if row 42 ran) is taken.
STOP if `signer_members` is not 0, `sums_ok` is missing, or the Core is active.
Source: IMP R8 backup block; P-05 (socket form, no `-h`, C-4); P-06 (`--no-role-passwords`, C-5). `pg_dump` connects as `postgres` by peer over the socket (DB §3.2 line 1). The `if` guard and `umask 077` are additions of this row (unverified as a combined script).

#### Block Q: read-only SQL for verification (DB §7 precedent: checks run as `postgres` over the socket)

```
q() { hssh "sudo -n -u postgres env PGOPTIONS='-c default_transaction_read_only=on' psql -X -At -p 4432 -d dems_demo -c \"$1\""; }
```
Read-only by `default_transaction_read_only` (unverified on this server; it is a standard setting). Queries print ids, types, counts and booleans only; they never select `operator_credentials`, `capture_device_credentials` (except `count(*)`), `stt_config` secret columns or `audit_log.details` beyond named non-secret keys. Row start time for audit filters: `T0=$(hssh 'date +%s%3N')` recorded at the start of the row; `audit_log.at` is taken as epoch milliseconds (as `capture_devices.last_seen_at`, capture.ts comments; unverified for `audit_log`).

#### Block R and Block O (DB §4.4) with the C-1 additions

The generator `G` is DB §4.4 verbatim. C-1 adds the two `SET` lines at the head of every psql stdin that carries an `ALTER ROLE`:

```
SETS='SET log_min_error_statement TO panic; SET log_statement TO none;'
```
- Block R: `{ printf '%s\n' "$SETS" 'CREATE ROLE dems_owner ...;' 'CREATE ROLE dems_app ...;'; } | $PSQL` and `{ printf '%s\n' "$SETS"; "$NODE" --input-type=module -e "$G" "$APP_FILE" app </dev/null; } | $PSQL >/dev/null`.
- Block O: the `close()` function sends `printf '%s\nALTER ROLE dems_owner PASSWORD NULL;\n' "$SETS" | $PSQL >/dev/null`; the owner generator line becomes `{ printf '%s\n' "$SETS"; "$NODE" --input-type=module -e "$G" "$OWNER_FILE" owner </dev/null; } | $PSQL >/dev/null`.
The full texts are in rows 41 and 44.

### 1.5 Evidence each row writes

Each row writes its `Expected Output` file under the task folder with: the commands as sent, their printed output (names/counts only), the stop checks with their results, and for HIL rows the user's words quoted. Host-side evidence files are never copied off-host when they hold secrets (baseline folder, backups).

## 2. Execution order, edges and locks (as after E-1..E-17)

| Order | Rows | Edges that set the order (B = build) | Locks |
|---|---|---|---|
| 1 | 20 | 19:B, 119:B | host-ssh |
| 2 | 21 | 20:B | host-ssh |
| 3 | 123 | 21:B (E-4: right after 21) | host-ssh |
| 4 | 22, then 23 | 21:B, 123:B; 23 after 22 | host-ssh |
| 5 | 24 | 21:B, 123:B | apt-lock |
| 6 | 25 | 24:B, 8:C; **22:B requested (R18-1)** | host-ssh |
| 7 | 26 | 22:B, 121:B | host-ssh |
| 8 | 27 | 25:B, 26:B | heavy-host, npm-lockfile |
| 9 | 28 | 24:B, 9:C (after 27: one heavy row at a time) | heavy-host |
| 10 | 29, 30, 31 | 28:B, 26:B; then 29, 30 | heavy-host |
| 11 | 32 | 1:C (N/A record, docs only) | - |
| 12 | 33, 34, 38 | 21:B, 123:B (34 also 93:C) | host-ssh |
| 13 | 35 | 24:B, 22:B | host-ssh |
| 14 | 36 (HIL) | 33:B, 34:B, 14:C | user-terminal |
| 15 | 37 | 22:B, 24:B | host-ssh |
| 16 | 39 | 24:B, 10:C | apt-lock |
| 17 | 40 | 39:B | db |
| 18 | 41 | 40:B, **25:B, 26:B (E-1)** | db |
| 19 | 42 | 41:B, 31:B | host-ssh |
| 20 | 43 | 42:B, 35:B, 23:B, **40:B (E-2)** | host-ssh |
| 21 | 44 | 41:B, 27:B | db |
| 22 | 45 | 43:B, 106:C | host-ssh |
| 23 | 122 | 27:B, 15:C | host-ssh |
| 24 | 46 gate G1 | 44, 45, 36, 37, 38, 32, 122, 123 (all B) | - |
| 25 | 47 (HIL reboot) | 46:B | host-reboot, user-terminal |
| 26 | 48 | 47:B | core-unit, db |
| 27 | 49 | 48:B, 122:B | Mac port 5173 |
| 28 | 50, 51 (HIL) | 49:B; 51 after 50 | user-terminal, db |
| 29 | 52 | 51:B | core-unit, db |
| 30 | 53 gate G2 | 52:B | - |
| 31 | 54, 55, 56 (HIL) | 53:B, 4:C; then in order | user-terminal |
| 32 | 57 | 56:B | host-ssh (+ user-terminal for the name, I-13) |
| 33 | 58 | 57:B | core-unit, db |
| 34 | 59 | 58:B | host-ssh |
| 35 | 60 gate G3 | 59:B | - |
| 36 | 61, 124 (N/A record, E-9) | 60:B | - |
| 37 | 62, 63, 64, 65 (HIL) | 60:B, then in order | user-terminal |
| 38 | 66, 67, 68, 69 (HIL) | 66: 62:B, 124:B, 49:C; then in order | user-terminal, db |
| 39 | 125, 126, 127 (HIL) | 125: 69:B, 37:B; then in order | user-terminal, db |
| 40 | 70 | 127:B | host-ssh |
| 41 | 71 (HIL reboot) | 70:B | host-reboot, user-terminal |
| 42 | 72, 73, 128 | 71:B | - / host-ssh / db (+ user-terminal for the search in 128, R18-7) |
| 43 | 74, then 75, 76, 77, then 78, then 79 | as blueprint | - |

## 3. Row sections

Each section: **Source**, **Pre**, **Commands**, **Files written** (owner, mode), **Expected**, **STOP**, and for HIL rows **Hand-over** (PREPARE / USER / VERIFY). Block P runs first in every host row and is not repeated below.

---

### Row 20: pre-change host baseline (SI-02; IMP §4.3 with C-3, P-04, P-17)

**Pre.** Gate G-RF (row 119) recorded as passed; row 19 complete. Host read-only until this block.

**Commands.**
```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
umask 077
B=/home/gsp-dems/dems-host-baseline-$(date +%Y%m%d)
test -z "$(ls -d /home/gsp-dems/dems-host-baseline-* 2>/dev/null)"     # exactly one folder ever
install -d -m 0700 -o gsp-dems -g gsp-dems "$B"
cp -a --parents /etc/passwd /etc/group /etc/shadow /etc/gshadow /etc/default/ufw /etc/ufw "$B"/
[ -e /etc/default/apport ] && cp -a --parents /etc/default/apport "$B"/
systemctl is-enabled apport.service > "$B"/apport_enabled.txt 2>&1 || true
dpkg-query -W -f='${binary:Package}\t${Version}\t${db:Status-Abbrev}\n' | sort > "$B"/dpkg.txt
apt-mark showmanual | sort > "$B"/apt_manual.txt
systemctl list-unit-files --state=enabled --no-legend | sort > "$B"/units_enabled.txt
ufw status verbose > "$B"/ufw_status.txt
sysctl net.ipv4.ip_forward net.ipv6.conf.all.forwarding net.ipv4.conf.enp4s0.forwarding kernel.core_pattern fs.suid_dumpable > "$B"/sysctl.txt
ls -la /etc/apt/sources.list.d /etc/systemd/system > "$B"/etc_lists.txt
du -sb /var/lib/docker /var/lib/containerd > "$B"/docker_kept_du.txt
if (cd /home/gsp-dems/dems-backup-20261021 && sha256sum -c --quiet SHA256SUMS) > "$B"/backup_check.txt 2>&1; then echo backup_check_exit=0 >> "$B"/backup_check.txt; else echo backup_check_exit=1 >> "$B"/backup_check.txt; fi
tail -1 "$B"/backup_check.txt
ls -A /home/gsp-dems/dems-backup-20261021 > "$B"/backup_members.txt
stat -c '%U %a %n' /home/gsp-dems/dems-backup-20261021 > "$B"/backup_mode.txt
nmcli -t -f NAME,UUID,DEVICE connection show | sort > "$B"/nm_connections.txt
sha256sum /etc/NetworkManager/system-connections/* /etc/netplan/* /etc/sudoers.d/90-gsp-dems \
  /etc/NetworkManager/conf.d/zz-dems-wifi-powersave-off.conf /etc/modprobe.d/rtw88-dems.conf \
  /usr/local/sbin/dems-wifi-watchdog /etc/systemd/system/dems-wifi-watchdog.service /etc/systemd/system/dems-wifi-watchdog.timer \
  > "$B"/kept_files.sha256
(cd /home/gsp-dems/DEMS-Linux-Docker-LCD-20261019-amd64-unverified && sha256sum .env .installed) > "$B"/docker_install_folder.sha256
ip -br addr > "$B"/ip_addr.txt; ip -4 route > "$B"/ip_route.txt; ss -H -ltnp > "$B"/listeners.txt
touch "$B"/marker
echo "etc_newer_than_marker=$(find /etc -type f -newer "$B"/marker | wc -l)"
find "$B" -type f ! -name SHA256SUMS.baseline -exec sha256sum {} + > "$B"/SHA256SUMS.baseline
echo "baseline_dir=$B"; stat -c '%U:%G %a %n' "$B"
cut -d' ' -f3- "$B"/SHA256SUMS.baseline | sed "s#^$B/##" | sort
EOF
```
Then Block E (it reads the folder just made).

**Files written.** `/home/gsp-dems/dems-host-baseline-<YYYYMMDD>/` `gsp-dems:gsp-dems` 0700; members root-owned (copies keep their source owner/mode; new lists `root` 0600 by `umask 077`). Layout mirrors absolute paths: `<B>/etc/ufw/ufw.conf`, `<B>/etc/default/ufw` (C-3). Never copied off-host (holds `/etc/shadow` copies).

**Expected.** `etc_newer_than_marker=0`; `gsp-dems:gsp-dems 700 <B>`; the member list; Block E prints `docker_du_equal`, `backup_ok`. For the artifact `initialization/01_env_check.md`: the file list with sha256 per copied file (copy `SHA256SUMS.baseline` lines: hashes and relative names only; the hash of a shadow copy is not a secret), the folder mode.

**STOP.** A baseline folder already exists; `backup_check_exit` not 0; any `cp` fails; Block E differs. Source: IMP §4.3, C-3, P-04, P-17; additions (NM, netplan, Wi-Fi fix files, sudoers, install-folder hashes, `ls` of backup members for the R4 nmconnection path) from IMP §4.2 rows "check" column. The `sha256sum ... .env .installed` hashes values but prints only hashes (IMP §4.2).

---

### Row 21: preflight HOST-01..03, HOST-17 (E-3), HOST-21 re-check (SI-01)

**Commands.**
```
hssh 'sudo -n bash -s' <<'EOF'
lsb_release -ds; uname -m
systemctl list-unit-files 'dems-nvr*' 'dems-mediamtx*' | tail -1
ls /usr/local/sbin/dems-netalias /etc/sudoers.d/dems-netalias 2>&1 | grep -c 'No such file or directory'
awk -F: '$7 !~ /nologin$/ && $7 !~ /false$/ {print $1}' /etc/passwd
ps -axo pid=,comm= | awk '{print length($2)}' | sort -n | tail -1      # longest short name
ps -axo pid=,args= | awk '$2 ~ /^\//' | wc -l                           # count of full-path args
dpkg -l 'docker*' 'containerd*' 'libvirt*' 'wireguard*' 2>/dev/null | grep -c '^ii' || true
EOF
```
**Expected.** `Ubuntu 24.04.1 LTS`, `x86_64` (HOST-01); `0 unit files listed.` and `2` (HOST-02); `root`, `sync`, `gsp-dems` only (HOST-03; hypothesis until now, APP:64); HOST-17: longest `comm` at most 15 and a non-zero count of full-path `args` lines, both recorded (HP HOST-17; the two observations are recorded, not judged); HOST-21: `0`.
**STOP.** HOST-01/02/21 differ; HOST-03 lists another login account (removal is the user's action, HP HOST-03).
Source: HP §3.1, HOST-17, HOST-21; APP:62-64, :78, :82. The `awk` reductions of the two `ps` observations are this row's (unverified), so no process list is copied into the docs.

---

### Row 123: watchdog no-reboot flag, right after row 21 (SI-03; D16 I-17; E-4)

**Commands.**
```
hssh 'sudo -n bash -s' <<'EOF'
set -e
[ -e /etc/dems-wifi-watchdog.noreboot ] || install -m 0644 -o root -g root /dev/null /etc/dems-wifi-watchdog.noreboot
stat -c '%U:%G %a %s' /etc/dems-wifi-watchdog.noreboot
systemctl is-active dems-wifi-watchdog.timer
B=$(ls -d /home/gsp-dems/dems-host-baseline-*); grep -c dems-wifi-watchdog "$B"/kept_files.sha256
sha256sum /usr/local/sbin/dems-wifi-watchdog /etc/systemd/system/dems-wifi-watchdog.service /etc/systemd/system/dems-wifi-watchdog.timer | diff -q - <(grep dems-wifi-watchdog "$B"/kept_files.sha256) && echo watchdog_unchanged
pgrep -c -x 'apt-get|dpkg|make|npm' || true
EOF
```
**Files written.** `/etc/dems-wifi-watchdog.noreboot`, `root:root` 0644, empty (register §3.2).
**Expected.** `root:root 644 0`; `active`; `3`; `watchdog_unchanged`; `0` (flag present before any apt/dpkg, build or migration: the E-4 verification line).
**STOP.** Timer not active; a dpkg/make/npm process already running.
**Rollback.** IMP R3: `sudo rm /etc/dems-wifi-watchdog.noreboot` only with no session recording.
Source: register §3.2; IMP R3; 02_host_wifi_outage_20261022.md:62. The `pgrep` line is this row's (unverified pattern form).

---

### Row 22: accounts and directories (SI-04, SI-05; HOST-04..07; E-16, I-01)

**Commands.**
```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
stat -c '%U:%G %a' /opt                                      # must print root:root 755 before anything
getent passwd dems-core >/dev/null || useradd --system --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin dems-core
getent passwd dems-console >/dev/null || useradd --system --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin dems-console
install -d -o root -g root -m 0755 /opt/dems /opt/dems/core
install -d -o dems-core -g dems-core -m 0700 /opt/dems/core/.data /opt/dems/core/.data/media /opt/dems/core/.data/media/sessions
getent passwd dems-core dems-console | awk -F: '{print $1, $6, $7}'
stat -c '%U %G %a' /opt/dems/core/.data /opt/dems/core/.data/media/sessions
namei -l /opt/dems/core/.data
findmnt -no FSTYPE,SOURCE --target /opt/dems/core/.data/media/sessions
EOF
```
**Files written.** Accounts `dems-core`, `dems-console` (system, nologin, home `/nonexistent`, no home created); `/opt/dems`, `/opt/dems/core` root 0755; `.data`, `.data/media`, `.data/media/sessions` `dems-core:dems-core` 0700. `/etc/passwd`, `/etc/group`, `/etc/shadow`, `/etc/gshadow` modified (baseline copies exist).
**Expected.** `/opt` = `root:root 755`; `dems-core /nonexistent /usr/sbin/nologin` and `dems-console /nonexistent /usr/sbin/nologin` (HOST-04 check: line ends with nologin; home deviation I-01); `dems-core dems-core 700` twice (HOST-06); `namei -l` shows `root root` `drwxr-xr-x` for `/`, `opt`, `dems`, `core`, and `dems-core dems-core drwx------` for `.data` (no group/other `w` above); `ext4 /dev/...` (HOST-07, partial; rest at row 58).
**STOP.** `/opt` not `root:root 755` (do not change it; report); a `dems*` account already exists with another shell or home.
Source: SVC §3; register §2, §3.1; HP HOST-04..07; APP:65-68.

---

### Row 23: helper group (HOST-43; SI-04)

```
hssh 'sudo -n bash -s' <<'EOF'
getent group dems-netalias >/dev/null || groupadd --system dems-netalias
id -nG dems-core | tr ' ' '\n' | grep -qx dems-netalias || usermod -aG dems-netalias dems-core
getent group dems-netalias | awk -F: '{print $1, $4}'
EOF
```
**Expected.** `dems-netalias dems-core` (member list exactly the service user). Nothing else of the helper is installed (HP §3.8). **STOP.** Any other member. Source: SVC §3; HP HOST-43.

---

### Row 24: apt package set (SI-06; HOST-10, -11, -18, nftables, alsa-utils, iputils-ping)

**Pre.** Block P disk guard. `apt-lock` held by this row only.

**Commands.**
```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
P='build-essential clang make pkg-config python3 nasm libasound2-dev iputils-arping iproute2 nftables alsa-utils iputils-ping gnupg curl ca-certificates xz-utils'
apt-get -o DPkg::Lock::Timeout=300 update -q >/dev/null
apt-get -s install $P | grep -E '^(Inst|Remv) ' | awk '{print $1, $2}' > /tmp/row24_plan.txt
echo "remv_lines=$(grep -c '^Remv' /tmp/row24_plan.txt || true)"
echo "banned_in_plan=$(grep -c -E 'docker|containerd|libavformat-dev|libavcodec-dev| arping$' /tmp/row24_plan.txt || true)"
EOF
```
STOP if `remv_lines` or `banned_in_plan` is not 0. Otherwise, detached (SI-00g; register `host_build_unit`):
```
hssh 'sudo -n systemd-run --unit=dems-host-build-row24 --collect -p Environment=DEBIAN_FRONTEND=noninteractive /bin/bash -c "apt-get -o DPkg::Lock::Timeout=300 install -y build-essential clang make pkg-config python3 nasm libasound2-dev iputils-arping iproute2 nftables alsa-utils iputils-ping gnupg curl ca-certificates xz-utils > /var/log/dems-host-build-row24.log 2>&1; echo \$? > /var/log/dems-host-build-row24.exit"'
# later, one check per few minutes:
hssh 'systemctl is-active dems-host-build-row24.service; sudo -n cat /var/log/dems-host-build-row24.exit 2>/dev/null'
```
Checks after exit 0:
```
hssh 'sudo -n bash -s' <<'EOF'
dpkg -s clang make pkg-config python3 nasm libasound2-dev 2>/dev/null | grep -c '^Status: install ok installed'
dpkg -s nftables alsa-utils iputils-ping 2>/dev/null | grep -c '^Status: install ok installed'
dpkg -s libavformat-dev 2>&1 | grep -c 'is not installed'
dpkg -S "$(command -v arping)"; dpkg -s arping 2>&1 | grep -c 'is not installed'
grep -x /usr/bin/arping /var/lib/dpkg/info/iputils-arping.list
a=$(grep '  usr/bin/arping$' /var/lib/dpkg/info/iputils-arping.md5sums | cut -c1-32); b=$(md5sum /usr/bin/arping | cut -c1-32); [ "$a" = "$b" ] && echo arping_md5_equal
dpkg --verify iputils-arping | wc -l
stat -L -c '%U %a %n' /usr/sbin/ip /usr/bin/arping
dpkg --audit | wc -l
EOF
```
Then Block E.
**Files written.** Packages only; the plan list `/tmp/row24_plan.txt` and the log/exit files under `/var/log/dems-host-build-row24.*` (root, 0644 by default; no secret).
**Expected.** `6`; `3`; `1` (HOST-11); `iputils-arping: /usr/bin/arping`, `1`; `/usr/bin/arping`; `arping_md5_equal`; `0`; two lines `root 755 ...` (HOST-18); `0` (`dpkg --audit` silent).
**STOP.** Exit file not `0`; any expected value differs. A dropped SSH session does not stop the detached unit (IMP R2); after an interrupted dpkg: `sudo dpkg --audit`, `sudo dpkg --configure -a` and report (IMP R2 rollback).
Source: HP HOST-10, -11, -18, -25, -26, §3.11 (`iputils-ping`); APP:71-72, :79; 02_structured.md row 24. Added to the set by this row: `gnupg curl ca-certificates xz-utils` (needed by rows 25, 28, 39; DB §7 HOST-50 names `curl ca-certificates gnupg`); the simulation filter and the detached form are this row's (unverified wording; R18-2).

---

### Row 25: Node 26.12.1 with signature-verified checksum (SI-07; HOST-09; U-RF8, W11)

**Pre.** `/opt/dems` exists `root:root 755` (row 22; edge request R18-1). Row 24 done (gnupg, curl, xz-utils).

**Important.** The checksum gate is the line of the **signed** `SHASUMS256.txt.asc` fetched on the host and verified here. This runbook does not write a checksum value. `research/02_collection_node.md` §2 holds a 26.12.1 line "for reference only" and register §7.1 cites it; it is used below only as a secondary comparison, and a mismatch is a STOP.

**Commands.**
```
hssh 'bash -s' <<'EOF'
set -euo pipefail
D=$(mktemp -d); cd "$D"; echo "dl_dir=$D"
U=https://nodejs.org/dist/v26.12.1
curl -fsSLO "$U/SHASUMS256.txt"
curl -fsSLO "$U/SHASUMS256.txt.asc"
curl -fsSLO "$U/node-v26.12.1-linux-x64.tar.xz"
curl -fsSL -o nodejs-keyring.kbx https://github.com/nodejs/release-keys/raw/HEAD/gpg/pubring.kbx
gpgv --keyring "$D/nodejs-keyring.kbx" --status-fd 1 SHASUMS256.txt.asc 2>/dev/null | grep -E '^\[GNUPG:\] (GOODSIG|VALIDSIG) ' | awk '{print $2, $NF}'
L_ASC=$(grep -E '^[0-9a-f]{64}  node-v26\.12\.1-linux-x64\.tar\.xz$' SHASUMS256.txt.asc)
L_TXT=$(grep -E '^[0-9a-f]{64}  node-v26\.12\.1-linux-x64\.tar\.xz$' SHASUMS256.txt)
echo "lines_in_asc=$(printf '%s\n' "$L_ASC" | wc -l) lines_in_txt=$(printf '%s\n' "$L_TXT" | wc -l)"
[ "$L_ASC" = "$L_TXT" ] && echo txt_equals_signed
printf '%s\n' "$L_ASC" | sha256sum -c -
printf '%s\n' "$L_ASC"
EOF
```
**Expected.** A `GOODSIG` line and a `VALIDSIG <primary fingerprint>` line; the fingerprint printed is one of the eight in `research/02_collection_node.md` §5 (README key list, W11); `lines_in_asc=1 lines_in_txt=1`; `txt_equals_signed`; `node-v26.12.1-linux-x64.tar.xz: OK`; the printed line (public hash) equals the register §7.1 publisher line character for character (compared by the executor, recorded with both sources).
**STOP.** No `VALIDSIG`; signer not in the README list; any line count not 1; `sha256sum -c` not `OK`; the signed line differs from register §7.1. Do not install a file that failed any of these.

Install (same `$D`, root-owned path):
```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
D=<dl_dir printed above>
test ! -e /opt/dems/node-26.12.1
install -d -o root -g root -m 0755 /opt/dems/node-26.12.1
tar -C /opt/dems/node-26.12.1 --strip-components=1 --no-same-owner --no-same-permissions -xJf "$D/node-v26.12.1-linux-x64.tar.xz"
/opt/dems/node-26.12.1/bin/node --version
namei -l /opt/dems/node-26.12.1/bin/node | awk 'NR>1{print $1, $2, $3}'
find /opt/dems/node-26.12.1 ! -type l -perm /022 -print -quit | wc -l
find /opt/dems/node-26.12.1 ! -user root -print -quit | wc -l
rm -rf -- "$D"
EOF
```
**Files written.** `/opt/dems/node-26.12.1/` root:root, 0755 dirs, no group/other `w`.
**Expected.** `v26.12.1`; every `namei` component owner `root`, no `w` for group/other (symlinks excepted); `0`; `0`.
**STOP.** Version differs; any `w` for group/other; any non-root owner.
Source: register §7.1; research/02_collection_node.md §3 (URL pattern), §5 (keyring URL, README key list); HP HOST-09. The `gpgv --keyring <kbx> --status-fd 1` form and the README's own verification line are **(unverified)**: row 8 cites the README's `curl` keyring line (README:113-116) but not its `gpgv` line. The `--strip-components` install form is this row's (unverified for the archive's top-level layout; expected `node-v26.12.1-linux-x64/`).

---

### Row 26: place the changed tree from `tree_staging_dir` (SI-08; IMP R8; C-20; OI-7)

**Pre.** Row 121 recorded `host manifest sha256 equals Mac manifest sha256` and the RB-1 `rflex_only_diff` hash (implementation/68_rflex_tree_transfer.md). SI-00c: `.data` stat before.

**Commands.**
```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
S=$(ls -d /home/gsp-dems/dems-tree-staging-* | tail -1); echo "staging=$S"
test -d "$S" && test ! -e "$S/.data" && test ! -e "$S/node_modules" && test ! -e "$S/.git"
echo "data_before=$(stat -c '%U:%G %a' /opt/dems/core/.data)"
tar -C "$S" --exclude=./.data -cf - . | tar -C /opt/dems/core --no-same-owner --no-same-permissions --no-overwrite-dir -xf -
install -d -o dems-core -g dems-core -m 0700 /opt/dems/core/.data /opt/dems/core/.data/media /opt/dems/core/.data/media/sessions /opt/dems/core/apps/core-server/logs
echo "data_after=$(stat -c '%U:%G %a' /opt/dems/core/.data)"
stat -c '%U:%G %a %n' /opt/dems/core /opt/dems/core/apps/core-server/logs
man() { (cd "$1" && find . \( -path ./.data -o -path ./apps/core-server/logs \) -prune -o -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -c1-64); }
echo "manifest_staging=$(man "$S")"
echo "manifest_install=$(man /opt/dems/core)"
find /opt/dems/core -path /opt/dems/core/.data -prune -o -path /opt/dems/core/apps/core-server/logs -prune -o \( ! -user root -o -perm /022 \) ! -type l -print | wc -l
namei -l /opt/dems/core/apps/core-server/src/index.ts | awk 'NR>1{print $1, $2, $3}'
EOF
```
**Files written.** The tree under `/opt/dems/core`, `root:root`, modes from the archive minus umask 022; `/opt/dems/core/apps/core-server/logs` `dems-core:dems-core` 0700. `.data` untouched.
**Expected.** `data_before=dems-core:dems-core 700` = `data_after`; `/opt/dems/core` stays `root:root 755`; `manifest_staging` = `manifest_install`; `0` (no non-root owner, no group/other `w` outside the two writable paths); `namei` all `root`, no `w` for group/other. OI-7 record in implementation/06_source_placement.md: Mac HEAD (row 80/120), the commit hash if row 120 committed on the user's word, else the RB-1 `rflex_only_diff` sha256 from row 121; the two manifest hashes above.
**STOP.** Staging contains `.data`, `node_modules` or `.git`; `.data` stat changed; manifests differ; `/opt/dems/core` not `root:root 755` after extraction. Never `--delete`, never `chown -R` (SI-00c). A later re-copy follows C-20 (list extra files, remove one by one under R7/R8, Block K first).
Source: IMP R8 copy form; SVC §2 ordering note; C-20. **Correction by this row (R18-3):** IMP R8's `tar -C "$S" ... -cf - .` archives the member `./` with the staging folder's mode (0700, register §11.1); without `--no-overwrite-dir` the extraction would set `/opt/dems/core` to 0700 and lock the service accounts out. `--no-overwrite-dir` keeps the metadata of existing directories (GNU tar option; behaviour on `.` **(unverified)**, hence the stat check). The manifest function (find/sort/sha256) is this row's (unverified); the row-121 manifest form is row 121's, so both sides are recomputed here on the host with one function.

---

### Row 27: `npm ci` as root, scripts off (SI-09; SEC §5 option A, SEC-NPM)

**Pre.** Block P disk guard. `heavy-host`, `npm-lockfile`. SI-00c stat before.

**Commands.**
```
hssh 'sudo -n systemd-run --unit=dems-host-build-row27 --collect -p WorkingDirectory=/opt/dems/core -p Environment=PATH=/opt/dems/node-26.12.1/bin:/usr/bin:/bin /bin/bash -c "C=\$(mktemp -d /root/npm-cache.XXXXXX); npm ci --ignore-scripts --no-audit --no-fund --cache \"\$C\" -w @dems/shared -w @dems/capture-protocol -w @dems/transcriber -w @dems/core-server -w @dems/core-web > /var/log/dems-host-build-row27.log 2>&1; echo \$? > /var/log/dems-host-build-row27.exit; rm -rf -- \"\$C\""'
hssh 'systemctl is-active dems-host-build-row27.service; sudo -n cat /var/log/dems-host-build-row27.exit 2>/dev/null'
```
Checks after exit 0:
```
hssh 'sudo -n bash -s' <<'EOF'
cd /opt/dems/core
test -f node_modules/tsx/dist/cli.mjs && echo tsx_ok
test -f node_modules/vite/bin/vite.js && echo vite_ok
find node_modules -perm /022 ! -type l -print -quit | wc -l
find node_modules ! -user root -print -quit | wc -l
stat -c '%U:%G %a' /opt/dems/core/.data
/opt/dems/node-26.12.1/bin/node node_modules/tsx/dist/cli.mjs --version
ls -d /root/npm-cache.* 2>/dev/null | wc -l
EOF
```
**Files written.** `/opt/dems/core/node_modules` (root-owned); log/exit under `/var/log/dems-host-build-row27.*`. Throw-away cache under `/root`, removed.
**Expected.** exit `0`; `tsx_ok`, `vite_ok`; `0`; `0`; `dems-core:dems-core 700`; a tsx version line (Docker precedent check, SEC §5); `0`.
**STOP.** Non-zero exit; a needed binary missing (do not switch to scripts-on without a recorded decision, SEC §5); `.data` stat changed.
Source: SEC §5 (command and checks); SVC §9 A1. The `systemd-run` wrapping and the in-unit `mktemp` are this row's (unverified quoting; R18-2).

---

### Row 28: FFmpeg 9.0.2 LGPL into `/opt/dems/ffmpeg-9.0.2` (SI-10; HOST-12, -13; U-RF9)

**Pre.** Block P disk guard. `heavy-host` (not beside row 27).

**Fetch and verify (as `gsp-dems`, in `ffmpeg_build_dir`):**
```
hssh 'bash -s' <<'EOF'
set -euo pipefail
F=/home/gsp-dems/dems-ffmpeg-build-9.0.2
test ! -e "$F"; install -d -m 0700 "$F"; cd "$F"
curl -fsSLO https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz
curl -fsSLO https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz.asc
curl -fsSLO https://ffmpeg.org/ffmpeg-devel.asc
install -d -m 0700 "$F/gnupg"
gpg --homedir "$F/gnupg" --batch --quiet --import ffmpeg-devel.asc
gpg --homedir "$F/gnupg" --batch --status-fd 1 --verify ffmpeg-9.0.2.tar.xz.asc ffmpeg-9.0.2.tar.xz 2>/dev/null | grep -c '^\[GNUPG:\] VALIDSIG .*FCF986EA15E6E293A5644F10B4322F04D67658D8'
echo "8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e  ffmpeg-9.0.2.tar.xz" | sha256sum -c -
tar -xJf ffmpeg-9.0.2.tar.xz
EOF
```
STOP unless `1` and `ffmpeg-9.0.2.tar.xz: OK`.

**Build, detached as `gsp-dems`:**
```
hssh 'sudo -n systemd-run --unit=dems-host-build-row28 --collect -p User=gsp-dems -p WorkingDirectory=/home/gsp-dems/dems-ffmpeg-build-9.0.2/ffmpeg-9.0.2 /bin/bash -c "(./configure --prefix=/opt/dems/ffmpeg-9.0.2 --enable-shared --disable-static --disable-doc --enable-indev=alsa && make -j\$(nproc)) > ../build.log 2>&1; echo \$? > ../build.exit"'
hssh 'systemctl is-active dems-host-build-row28.service; cat /home/gsp-dems/dems-ffmpeg-build-9.0.2/build.exit 2>/dev/null'
```
**Install, file A, checks (exit file `0`):**
```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
make -C /home/gsp-dems/dems-ffmpeg-build-9.0.2/ffmpeg-9.0.2 install > /var/log/dems-host-build-row28-install.log 2>&1
printf '%s\n' /opt/dems/ffmpeg-9.0.2/lib | install -m 0644 -o root -g root /dev/stdin /etc/ld.so.conf.d/dems-ffmpeg.conf
ldconfig
P=/opt/dems/ffmpeg-9.0.2/bin/ffmpeg
$P -hide_banner -version | head -1
$P -hide_banner -version | grep -c 'libavformat  *63\. *1\.102'
$P -hide_banner -devices 2>/dev/null | grep -c -E '^ *D.* alsa'
$P -hide_banner -L 2>/dev/null | grep -c 'Lesser General Public License'
ldconfig -p | grep 'libavformat.so.63 ' | grep -c '/opt/dems/ffmpeg-9.0.2/lib'
find /opt/dems/ffmpeg-9.0.2 ! -type l \( -perm /022 -o ! -user root \) -print -quit | wc -l
stat -c '%U:%G %a' /etc/ld.so.conf.d/dems-ffmpeg.conf
EOF
```
**Files written.** `ffmpeg_build_dir` `/home/gsp-dems/dems-ffmpeg-build-9.0.2` gsp-dems 0700 (removed after row 31); prefix `/opt/dems/ffmpeg-9.0.2` root, no group/other `w`; file A `/etc/ld.so.conf.d/dems-ffmpeg.conf` root:root 0644, one line.
**Expected.** First line names `9.0.2`; `1` (libavformat 63.1.102); `1` (alsa with `D`); `>=1` (LGPL; no `--enable-gpl`); `1`; `0`; `root:root 644`. Then Block E is not due (stage end is row 31).
**STOP.** Signature or sha256 fails; configure/make exit not 0; any check differs.
Source: register §7.2; research/02_collection_ffmpeg.md; HP HOST-12, -13, file A; IMP R6. The `gpg --status-fd` VALIDSIG test mirrors Dockerfile:62-69 as cited by row 9; the `-L` licence grep and the `-devices` regex are **(unverified)** output forms.

---

### Row 29: capture worker (HOST-14; PD-11-03 named target set)

```
hssh 'sudo -n systemd-run --unit=dems-host-build-row29 --collect -p WorkingDirectory=/opt/dems/core -p Environment=PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig /bin/bash -c "make -C apps/capture-worker check selftest unit build/capture-worker > /var/log/dems-host-build-row29.log 2>&1; echo \$? > /var/log/dems-host-build-row29.exit"'
hssh 'systemctl is-active dems-host-build-row29.service; sudo -n cat /var/log/dems-host-build-row29.exit 2>/dev/null'
hssh 'sudo -n bash -s' <<'EOF'
cd /opt/dems/core
ldd apps/capture-worker/build/capture-worker | grep 'libavformat.so.63' | grep -c '/opt/dems/ffmpeg-9.0.2/lib'
ldd apps/capture-worker/build/capture-worker | grep -c 'not found'
namei -l /opt/dems/core/apps/capture-worker/build/capture-worker | awk 'NR>1{print $1, $2, $3}'
EOF
```
**Files written.** `apps/capture-worker/build/*` root-owned. **Expected.** exit `0` (static rules, self-test, unit checks, import check); `1`; `0`; every component `root`, no group/other `w` (HOST-05). **STOP.** Non-zero exit (read the last 40 log lines; route to the controller; no flag changes to pass a check). Source: APP HOST-14 (PD-11-03); research/01_explore_capture_build.md §1, §4 (REQUIRED set, Dockerfile:126-128).

### Row 30: camera relay (HOST-15 relay part)

```
hssh 'sudo -n systemd-run --unit=dems-host-build-row30 --collect -p WorkingDirectory=/opt/dems/core -p Environment=PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig /bin/bash -c "make -C apps/capture-worker relay-check relay-unit build/capture-relay > /var/log/dems-host-build-row30.log 2>&1; echo \$? > /var/log/dems-host-build-row30.exit"'
hssh 'sudo -n bash -s' <<'EOF'
cd /opt/dems/core
ldd apps/capture-worker/build/capture-relay | grep 'libavformat.so.63' | grep -c '/opt/dems/ffmpeg-9.0.2/lib'
PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig make -s -C apps/capture-worker versions | grep -c '63.1.102'
EOF
```
**Expected.** exit `0`; `1`; `>=1` (`make versions` prints the libavformat modversion, Makefile:293-295). "The relay states the library version" is read as the `ldd` resolution plus `make versions` (no relay flag that prints a version is cited; R18-4). **STOP.** Non-zero exit; library under another path. Source: research/01_explore_capture_build.md §1-§2.

### Row 31: guard program; build tree removal (HOST-15 guard part, HOST-16)

```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
cd /opt/dems/core
make -C apps/capture-worker build/capture-guard > /var/log/dems-host-build-row31.log 2>&1; echo "exit=$?"
ldd apps/capture-worker/build/capture-guard | grep -c -E 'libav|libsw' || true
namei -l /opt/dems/ffmpeg-9.0.2/bin/ffmpeg | awk 'NR>1{print $1, $2, $3}'
F=/home/gsp-dems/dems-ffmpeg-build-9.0.2
test "$F" = /home/gsp-dems/dems-ffmpeg-build-9.0.2 && rm -rf -- "$F"
test ! -e "$F" && echo build_tree_removed
test -x /opt/dems/ffmpeg-9.0.2/bin/ffmpeg && echo prefix_kept
EOF
```
Then Block E (stage S4 end).
**Expected.** `exit=0`; `0` (the guard links no FFmpeg library: "no library but the system's", capture_build §2); `namei` all `root`, no group/other `w` (HOST-16); `build_tree_removed`; `prefix_kept`.
**STOP.** Non-zero exit; the guard links an FFmpeg library. Note for row 19 (R18-4): the blueprint check "guard states library version" cannot hold for a program that links none; the row checks absence instead.
Source: research/01_explore_capture_build.md §1-§2; HP HOST-15, -16; IMP R6 (build tree removed after row 31).

---

### Row 32: web-console bundle build: N/A record (E-10)

Docs only. Write `implementation/12_web_console_build.md`: "N/A: the console is the Vite development server on 127.0.0.1:5173 started by `dems-console.service` (row 122); no bundle is built or served (research/01_explore_core_runtime.md:41, :45-48, :58; SVC §8.1)". No command.

---

### Row 33: file C and apport (SI-11; HOST-20, HOST-37; P-04)

```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
echo "apport_before=$(systemctl is-enabled apport.service 2>&1 || true)"
install -m 0644 -o root -g root /dev/stdin /etc/sysctl.d/60-dems-host.conf <<'C'
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0
kernel.core_pattern = |/bin/false
fs.suid_dumpable = 0
C
sysctl --system >/dev/null
systemctl disable --now apport.service 2>&1 | tail -1 || true
sysctl -n net.ipv4.ip_forward net.ipv6.conf.all.forwarding
cat /proc/sys/net/ipv4/conf/enp4s0/forwarding
sysctl -n kernel.core_pattern; sysctl -n fs.suid_dumpable
echo "apport_after=$(systemctl is-enabled apport.service 2>&1 || true)"
echo "var_crash_entries=$(ls -A /var/crash 2>/dev/null | wc -l)"
stat -c '%U:%G %a' /etc/sysctl.d/60-dems-host.conf
EOF
```
**Files written.** File C `/etc/sysctl.d/60-dems-host.conf` root:root 0644 (four lines, HP file C). Unit `apport.service` disabled (no apport file changed, P-04).
**Expected.** `apport_before` recorded (H-7); `0` `0`; `0`; `|/bin/false`; `0`; `apport_after=disabled` or `masked`; `var_crash_entries` recorded (the profile expects 0; existing crash files are recorded, not deleted); `root:root 644`.
**STOP.** Forwarding not 0 after `sysctl --system`.
**Rollback.** IMP §6 S5 (remove file C, `sysctl --system`; `systemctl enable --now apport.service` only if `apport_enabled.txt` of row 20 says `enabled`).
Source: HP file C, HOST-20, HOST-37; SVC §6; P-04.

### Row 34: camera port hygiene, read-only (SI-12; HD §7 row 34; "HOST-19 equivalent, host hygiene (E-P4)")

```
hssh 'bash -s' <<'EOF'
ip -br -4 addr show dev enp4s0 | awk '{print $3, $4}'
ip -br -4 addr show dev enp4s0 | awk '{print NF-2}'
ip -4 route show default | grep -c enp4s0 || true
nmcli -g connection.interface-name,ipv4.method,ipv4.gateway,ipv4.dns,ipv4.never-default,ipv6.method connection show "DEMS Camera LAN"
EOF
```
**Expected.** `192.168.100.254/24` alone (one address); `1`; `0`; `enp4s0`, `manual`, empty gateway, empty DNS, `yes`, `ignore` (row 6 survey). **STOP.** Any difference: never edit the NM profile in this row; report. Source: HD §3, §7 row 34; register §5.1; IMP R4. `nmcli -g` field list **(unverified)** names; the values are not secret (Ethernet profile, no key).

### Row 35: loopback rule, files D and E (SI-13; HOST-25)

```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
install -d -o root -g root -m 0755 /etc/dems
install -m 0644 -o root -g root /dev/stdin /etc/dems/loopback-ingest.nft <<'D'
table inet dems_loopback
delete table inet dems_loopback
table inet dems_loopback {
    chain output {
        type filter hook output priority filter; policy accept;
        oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != "dems-core" counter reject with tcp reset
    }
}
D
install -m 0644 -o root -g root /dev/stdin /etc/systemd/system/dems-loopback-rule.service <<'E'
[Unit]
Description=DEMS loopback rule for the camera listeners
Before=dems-core.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/nft -f /etc/dems/loopback-ingest.nft
ExecStop=/usr/sbin/nft delete table inet dems_loopback

[Install]
WantedBy=multi-user.target
E
systemd-analyze verify /etc/systemd/system/dems-loopback-rule.service
systemctl daemon-reload
systemctl enable --now dems-loopback-rule.service
systemctl is-active dems-loopback-rule.service
nft list table inet dems_loopback | grep -c -E 'tcp dport 8554-8564.*skuid != "?dems-core"?'
a=$(nft list table inet dems_loopback | grep -o 'packets [0-9]*' | awk '{print $2}')
sudo -u gsp-dems timeout 2 bash -c '</dev/tcp/127.0.0.1/8554' 2>/dev/null; true
b=$(nft list table inet dems_loopback | grep -o 'packets [0-9]*' | awk '{print $2}')
echo "counter_before=$a counter_after=$b"
stat -c '%U:%G %a %n' /etc/dems /etc/dems/loopback-ingest.nft /etc/systemd/system/dems-loopback-rule.service
EOF
```
**Files written.** `/etc/dems` root:root 0755 (HOST-34); file D `/etc/dems/loopback-ingest.nft` root 0644; file E `/etc/systemd/system/dems-loopback-rule.service` root 0644; unit enabled and active.
**Expected.** verify prints nothing; `active`; `1`; `counter_after` greater than `counter_before`; the three stat lines.
**STOP.** Verify error; counter does not rise. **Rollback.** IMP §6 S5. Source: HP files D, E, HOST-25; SVC §6; register §3.2, §4. The nft output regex is **(unverified)** (nft may print the user as a name or a number).

---

### Row 36 (HIL confirm): firewall (SI-14; SEC §2.2 R0-R8 with C-2; register `ufw_revert_unit` = `dems-ufw-revert`; E-15)

**Hand-over.**

PREPARE (executor, before the controller asks the user):
```
hssh 'sudo -n bash -s' <<'EOF'
# R0 read-only (I-12: record sshd settings; I-10: record built-in accepts)
sshd -T | grep -E '^(port|listenaddress|passwordauthentication|permitrootlogin|allowtcpforwarding|gatewayports) '
ufw status verbose | head -1
ufw show added
grep -E '^(IPV6|DEFAULT_FORWARD_POLICY)=' /etc/default/ufw
grep -nE 'echo-request|5353|1900' /etc/ufw/before.rules | cut -d: -f1 | tr '\n' ' '; echo
ip -br addr show wlp3s0 | awk '{print $1, $3}'; ip -br addr show enp4s0 | awk '{print $1, $3}'
systemctl is-active dems-wifi-watchdog.timer
# R1 SSH on wlp3s0 FIRST
ufw allow in on wlp3s0 to any port 22 proto tcp comment 'DEMS admin SSH on Wi-Fi (D5)'
# R2 defaults (nothing filters until R6)
ufw default deny incoming
ufw default allow outgoing
ufw default deny routed
# R3 HOST-23, camera port and Wi-Fi port (D33 M-6, replaces U-RF3; row 144)
ufw allow in on enp4s0 proto udp from any port 3702 comment 'DEMS camera search answers'
ufw allow in on wlp3s0 proto udp from any port 3702 comment 'DEMS camera search answers (Wi-Fi, D33)'
# R4 review
ufw show added
EOF
```
Expected R0: `port 22` (H-6), `allowtcpforwarding yes` (needed for OI-2/F7), `Status: inactive`, no user rule, IPV6 value recorded, line numbers of the built-in accepts recorded, both addresses, `active`. STOP if port is not 22 or forwarding is not allowed, or a user rule already exists (do not reset; user's call). Expected R4: exactly the R1 rule and the two R3 rules (plus their v6 twins if `IPV6=yes`).

The controller hands over to the USER the R4 list and this text: "ufw will be enabled with these rules only. A 5-minute automatic disable is armed first. If the agent loses SSH, wait 5 minutes; the host returns to ufw inactive. Do you give your yes for row 36?"

USER: answers yes or no in the chat. Nothing is typed on the host.

Then (only after the quoted yes) the executor runs R5-R8, applying R1's five stop preconditions first (IMP R1):
```
hssh 'sudo -n bash -s' <<'EOF'
sshd -T | awk '$1=="port"{print $2}'                                   # 22
ufw show added | grep -c 'allow in on wlp3s0 to any port 22 proto tcp'  # 1
journalctl -t dems-wifi-watchdog --since -15min -g 'reload' --no-pager -q | wc -l   # 0
# R5 arm the auto-revert (C-2 command)
systemd-run --unit=dems-ufw-revert --description='DEMS ufw auto-revert (row 36)' --on-active=300 /usr/sbin/ufw --force disable
systemctl list-timers --all --no-legend dems-ufw-revert.timer | wc -l    # 1
# R6
ufw --force enable
ufw status verbose | sed -n '1,4p'
EOF
# R7 FRESH session from the Mac, within the 5 minutes
ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -o BatchMode=yes -o ControlMaster=no -o ControlPath=none -o ConnectTimeout=15 gsp-dems@192.168.0.73 'sudo -n ufw status verbose | head -1; systemctl is-active dems-ufw-revert.timer'
# R8 disarm ONLY after R7 printed "Status: active"
ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -o BatchMode=yes -o ControlMaster=no -o ControlPath=none -o ConnectTimeout=15 gsp-dems@192.168.0.73 'sudo -n systemctl stop dems-ufw-revert.timer; systemctl is-active dems-ufw-revert.timer; sudo -n ufw status verbose | head -4; sudo -n ufw status numbered | grep -c 3702; sudo -n ufw status numbered | grep 3702 | grep -c "on enp4s0"; sudo -n ufw status numbered | grep 3702 | grep -c "on wlp3s0"'
```
VERIFY: R6 prints `Status: active`, `Default: deny (incoming), allow (outgoing), deny (routed)`; R7 prints `Status: active` and `active`; R8 prints `inactive` (timer), `Status: active`, `2`, `1`, `1` (exactly two rules naming 3702, one `on enp4s0` and one `on wlp3s0`: E-15 as changed by D33 M-6; doubled if `IPV6=yes`). Record the user's yes verbatim, the R0 records (sshd settings, built-in accepts: not a breach, I-10).

**Files written.** `/etc/ufw/ufw.conf` (ENABLED=yes), `/etc/ufw/user.rules`, `user6.rules`, `/etc/default/ufw` (routed policy) via ufw itself.
**STOP / failure path.** SEC §2.2: if R7 fails, retry once after 60 s; if it still fails, wait until 300 s after R5, log in again, record `Status: inactive` and `journalctl -u dems-ufw-revert.service --no-pager | tail -5`, report `blocked`. If SSH fails even after the revert: treat as the Wi-Fi fault; do not touch NetworkManager.
**Rollback.** IMP R1 with C-3 paths: `sudo ufw --force reset; sudo cp -a <B>/etc/ufw/ufw.conf /etc/ufw/ufw.conf; sudo cp -a <B>/etc/default/ufw /etc/default/ufw; grep ^ENABLED /etc/ufw/ufw.conf` (`ENABLED=no`).
Source: SEC §2.2 (R0-R8, order and texts), C-2 (`/usr/sbin/ufw --force disable`), IMP R1 (stop preconditions), HD §7 row 36.

---

### Row 37: audio access (SI-15; HOST-26..28; PD-11-05; I-06, I-08)

```
hssh 'sudo -n bash -s' <<'EOF'
id -nG dems-core | tr ' ' '\n' | grep -qx audio || usermod -aG audio dems-core
id -nG dems-core | tr ' ' '\n' | grep -c -x audio
dpkg -S /usr/bin/arecord
runuser -u dems-core -- /usr/bin/arecord -l | grep -c 'BOMGE USB AUDIO'
lsusb | grep -c '3347:2430'
grep -c 'USB-Audio - BOMGE USB AUDIO' /proc/asound/cards
N=$(awk '/USB-Audio - BOMGE USB AUDIO/{print $1}' /proc/asound/cards); echo "usb_card_index=$N"
ls /dev/snd/by-id/ | grep -c -i bomge
readlink -f /dev/snd/by-id/*[Bb][Oo][Mm][Gg][Ee]* 2>/dev/null | sed 's#.*/##'
loginctl list-sessions --no-legend | awk '{print $4}' | grep -c seat0 || true
echo "usb_capture_holders=$(fuser /dev/snd/pcmC${N}D*c 2>/dev/null | wc -w)"
for f in /dev/snd/pcmC*D*c; do printf '%s %s\n' "${f##*/}" "$(fuser "$f" 2>/dev/null | wc -w)"; done
pgrep -c -x 'pipewire|wireplumber|pulseaudio' || true
EOF
```
**Files written.** `/etc/group` (`audio` gains `dems-core`).
**Expected.** `1` (HOST-26 `id -nG` holds `audio`); `alsa-utils: /usr/bin/arecord`; `>=1` (card listed **by name**; numbers shift, 03_ D3); `1` (lsusb, HOST-27); `1` (driver `USB-Audio`, HOST-27); the index recorded; `1` by-id link resolving to `controlC<N>`; desktop seat sessions `0` for the HOST-28 reading; `usb_capture_holders=0`; per-node holder counts recorded (an ALC897 holder is recorded, not failed: PD-11-05); sound-server process count recorded (gap of row 6).
**STOP.** The USB card is not listed for `dems-core`; the USB capture node has a holder (HOST-28 fails for the DEMS card) while no desktop session is on seat0. If a seat0 session exists, record HOST-28 as "not measurable now: desktop session present" and report; the executor never logs a user out.
Source: HP HOST-26..28; APP:87-89 (PD-11-05); 03_deployment_check D2, D3. The `loginctl` column position, the by-id glob and the `/proc/asound/cards` awk are **(unverified)** output forms.

### Row 38: sleep and time (SI-16; HOST-29 re-check, -31, -32; P-03)

```
hssh 'sudo -n bash -s' <<'EOF'
systemctl is-enabled sleep.target suspend.target hibernate.target hybrid-sleep.target | sort | uniq -c
timedatectl show -p NTPSynchronized --value
systemctl enable systemd-time-wait-sync.service 2>&1 | tail -1
systemctl is-enabled systemd-time-wait-sync.service
systemctl show -p TimeoutStartUSec systemd-time-wait-sync.service
EOF
```
**Expected.** `4 masked` (no change: P-03; HP §6 "unmask" is not run on .73, E-5a); `yes`; `enabled`; the timeout recorded (IMP R5). **STOP.** Not 4 masked; NTP not `yes`. **Rollback.** `sudo systemctl disable systemd-time-wait-sync.service` (IMP §6 S7). Source: HP HOST-29, -31, -32; APP:90-93.

---

### Row 39: PostgreSQL 18.6 from PGDG, held (SI-17; HOST-50/51; DB §2, §7; I-16; C-13; H-2 pre-check)

**Pre.** `apt-lock`. Before the install, the executor reads the PostgreSQL 18.5 and 18.6 release notes (postgresql.org, from the Mac with WebFetch) and records any behaviour change this product depends on (DB §2.2 fallback rule; G-2). The executor chooses and records the independent fingerprint source (DB §2.3; A6).

**Key and source:**
```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
curl -sfI https://apt.postgresql.org/pub/repos/apt/dists/noble-pgdg/Release | head -1
install -d /usr/share/postgresql-common/pgdg
curl -fsS -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
gpg --show-keys --with-colons /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc | awk -F: '/^fpr/{print $10; exit}'
curl -fsS 'https://keyserver.ubuntu.com/pks/lookup?op=get&search=0xACCC4CF8' | gpg --show-keys --with-colons 2>/dev/null | awk -F: '/^fpr/{print $10; exit}'
EOF
```
Expected: both lines print `B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8` (register §7.3; DB §2.3). STOP on any mismatch or if the independent source is unavailable: remove nothing yet, do not add the source, ask the user (DB §2.3).
```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
install -m 0644 -o root -g root /dev/stdin /etc/apt/sources.list.d/pgdg.sources <<'S'
Types: deb deb-src
URIs: https://apt.postgresql.org/pub/repos/apt
Suites: noble-pgdg
Architectures: amd64
Components: main
Signed-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
S
apt-get -o DPkg::Lock::Timeout=300 update -q >/dev/null
apt-cache policy postgresql-18 | grep -c '18.6-1.pgdg24.04+2'
apt-cache policy postgresql-common | sed -n '2,3p'
EOF
```
Expected: `>=1`; candidate of `postgresql-common` from `apt.postgresql.org` recorded. If 18.6 is absent: fallback `18.4-1.pgdg24.04+1` per DB §2.2, recorded in decisions; neither: STOP.

**Install (createcluster switched off first):**
```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
V=18.6-1.pgdg24.04+2
apt-get -o DPkg::Lock::Timeout=300 install -y postgresql-common > /var/log/dems-row39-common.log 2>&1
C=/etc/postgresql-common/createcluster.conf
if grep -qE '^[#[:space:]]*create_main_cluster' "$C"; then sed -i -E 's/^[#[:space:]]*create_main_cluster.*/create_main_cluster = false/' "$C"; else printf 'create_main_cluster = false\n' >> "$C"; fi
grep -c '^create_main_cluster = false$' "$C"
apt-get -s install postgresql-18=$V postgresql-client-18=$V | grep '^Inst ' | awk '{print $2}' | grep -c -E 'postgresql-(19|20)' || true
apt-get -o DPkg::Lock::Timeout=300 install -y postgresql-18=$V postgresql-client-18=$V > /var/log/dems-row39-pg.log 2>&1
apt-mark hold postgresql-18 postgresql-client-18
dpkg-query -W -f='${Version}\n' postgresql-18
apt-mark showhold | grep -c -E '^postgresql-(client-)?18$'
pg_lsclusters | tail -n +2 | wc -l
dpkg --audit | wc -l
systemctl list-unit-files 'postgresql*' --no-legend | awk '{print $1}'
# H-2 pre-check for Block K (01_specs.md P-06 flagged it as "from knowledge")
pg_dumpall --help | grep -c -- '--no-role-passwords'
id -un postgres; ls -d /var/run/postgresql /etc/postgresql-common
EOF
```
Then Block E.
**Files written.** `/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc` (root 0644), `/etc/apt/sources.list.d/pgdg.sources` root 0644, `/etc/postgresql-common/createcluster.conf` (one line changed), packages held.
**Expected.** `1`; `0` (no 19/20 planned); `18.6-1.pgdg24.04+2`; `2`; `0` (no cluster: A2 holds); `0`; the unit file list (expect `postgresql.service`, `postgresql@.service`; H-1); **`1` for `--no-role-passwords`**; `postgres`; both paths present (P-13 hypothesis).
**STOP.** Fingerprint mismatch; planned 19/20; `dpkg --audit` not empty; `--no-role-passwords` count `0` (then Block K's globals line cannot run: report to the controller before row 44; options: drop the globals member, or take it without the option into a root-only file, a decision of the user). If a cluster `18 main` exists anyway: before any role exists, `sudo pg_dropcluster --stop 18 main` (DB §7 fallback), then row 40.
**Rollback.** IMP R11 (a) `dpkg --configure -a && apt-get -f install`; (b)/(c) remove, never purge.
Source: DB §2, §7 HOST-50/51; research/02_collection_pgdg.md §2-§4; IMP R11 stop rules. The keyserver URL form, the `createcluster.conf` sed and the `pg_dumpall --help` grep are **(unverified)**.

### Row 40: cluster on 4432, loopback only (SI-18; HOST-52/53; DB §3, §7)

```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
ss -H -ltn 'sport = :4432' | wc -l
pg_createcluster 18 main --port 4432 --encoding UTF8 --locale C.UTF-8 -- --auth-local=peer --auth-host=scram-sha-256 > /var/log/dems-row40-createcluster.log 2>&1
pg_lsclusters | tail -n +2
stat -c '%U %a' /var/lib/postgresql/18/main
pg_conftool 18 main set listen_addresses 127.0.0.1
pg_conftool 18 main set unix_socket_permissions 0700
pg_conftool 18 main set log_error_verbosity terse
H=/etc/postgresql/18/main/pg_hba.conf
O=$(stat -c '%U' "$H"); G=$(stat -c '%G' "$H"); M=$(stat -c '%a' "$H"); echo "hba_before=$O:$G $M"
install -m "$M" -o "$O" -g "$G" /dev/stdin "$H" <<'HBA'
# DEMS bench .73 (row 13 spec). Loopback TCP with scram only; the socket for the server account only.
local   all         postgres                          peer
host    postgres    dems_owner             127.0.0.1/32  scram-sha-256
host    dems_demo   dems_owner,dems_app    127.0.0.1/32  scram-sha-256
HBA
systemctl start postgresql@18-main.service
systemctl enable postgresql.service 2>&1 | tail -1
ss -H -ltn 'sport = :4432' | awk '{print $4}'
ss -H -ltn 'sport = :5432' | wc -l
stat -c '%U %a' /var/run/postgresql/.s.PGSQL.4432
sudo -u postgres psql -X -At -p 4432 -c 'SHOW listen_addresses'
sudo -u postgres psql -X -At -p 4432 -c 'SHOW server_version'
grep -v -E '^\s*(#|$)' "$H"
grep -c '^auto' /etc/postgresql/18/main/start.conf
ufw status | grep -c 4432 || true
systemctl is-enabled postgresql.service; systemctl is-active postgresql@18-main.service
EOF
```
**Files written.** Cluster `/var/lib/postgresql/18/main` (postgres 0700); `/etc/postgresql/18/main/{postgresql.conf,pg_hba.conf,start.conf}` (pg_hba replaced, owner/mode kept, expected `postgres:postgres 640`, DB §3.2).
**Expected.** `0` before; `18 main 4432 down postgres /var/lib/postgresql/18/main ...`; `postgres 700`; `hba_before` recorded; one line `127.0.0.1:4432`; `0`; `postgres 700` (socket; P-13); `127.0.0.1`; starts with `18.6`; the three lines of DB §3.2; `1`; `0`; `enabled`, `active`.
**STOP.** Any listener on `0.0.0.0`, `[::]` or `:5432` (IMP R11 row 40). Source: DB §3, §7 HOST-52/53/56; P-13, P-14, P-16.

### Row 41 (HIL per OI-4): roles and `pg.env` by Block R (SI-19; DB §4.1-4.4; C-1; C-19; E-1)

**Hand-over.**
PREPARE: run the dry check; confirm row 25 and row 26 are complete (E-1).
```
hssh '/opt/dems/node-26.12.1/bin/node --input-type=module -e "import(\"/opt/dems/core/scripts/pg/db.mjs\").then(m=>console.log(typeof m.scramVerifier))"'
```
Expected `function`. The controller tells the user: "Row 41 creates the two database roles. Under OI-4 option B (D8) the agent generates both secrets on the host straight into `pg.env` and the server; nothing is typed by you and no value is shown."
USER: nothing to type (OI-4 option B; D3). The user may stop the row by saying so.
Executor runs Block R:
```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
umask 077
PSQL='sudo -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -p 4432 -d postgres'
NODE=/opt/dems/node-26.12.1/bin/node
APP_FILE=/opt/dems/core/.data/pg.env
SETS='SET log_min_error_statement TO panic; SET log_statement TO none;'
G='import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { scramVerifier } from "/opt/dems/core/scripts/pg/db.mjs";
const [file, kind] = process.argv.slice(1);
const role = kind === "owner" ? "dems_owner" : "dems_app";
const k = kind === "owner" ? "OWNER" : "APP";
const secret = randomBytes(32).toString("base64url");
appendFileSync(file, `DEMS_PG_HOST=127.0.0.1\nDEMS_PG_PORT=4432\nDEMS_PG_DATABASE=dems_demo\nDEMS_PG_${k}_ROLE=${role}\nDEMS_PG_${k}_PASSWORD=${secret}\n`);
process.stdout.write(`ALTER ROLE ${role} PASSWORD \x27${scramVerifier(secret)}\x27;\n`);'
test ! -e "$APP_FILE"
printf '%s\n' "$SETS" \
  'CREATE ROLE dems_owner LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL;' \
  'CREATE ROLE dems_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL;' | $PSQL
install -m 0600 -o dems-core -g dems-core /dev/null "$APP_FILE"
trap 'rm -f -- "$APP_FILE"' ERR
{ printf '%s\n' "$SETS"; "$NODE" --input-type=module -e "$G" "$APP_FILE" app </dev/null; } | $PSQL >/dev/null
trap - ERR
echo block_r_done
EOF
```
VERIFY:
```
hssh 'sudo -n bash -s' <<'EOF'
sudo -u postgres psql -X -At -p 4432 -d postgres -c "SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin, rolpassword IS NULL FROM pg_authid WHERE rolname IN ('dems_app','dems_owner') ORDER BY 1"
stat -c '%U %G %a' /opt/dems/core/.data/pg.env
cut -d= -f1 /opt/dems/core/.data/pg.env
grep -c '^DEMS_PG_APP_PASSWORD=.' /opt/dems/core/.data/pg.env
test ! -e /opt/dems/core/.data/pg.owner.env && echo owner_file_absent
grep -c 'ALTER ROLE' /var/log/postgresql/postgresql-18-main.log || true
EOF
```
Expected: `block_r_done`; `dems_app|f|f|f|f|f|t|f` and `dems_owner|f|t|f|f|f|t|t`; `dems-core dems-core 600`; the five key names; `1`; `owner_file_absent` (C-19); `0` (no statement text in the server log; P-16 path hypothesis). Run the section 1.2 scan over the row's artifact.
**STOP.** Any `CREATE ROLE` error (roles exist: report, do not drop); `pg.env` exists before the block. Rotation later: DB §4.4 note. Source: DB §4.1-4.4, §7 HOST-54; C-1; C-19; SEC S3.

### Row 42: `/etc/dems/core.env`, SIMULATED form (SI-20; SVC §5; C-6, C-7; I-05)

```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
test ! -e /etc/dems/core.env
install -m 0640 -o root -g dems-core /dev/stdin /etc/dems/core.env <<'ENV'
DEMS_CORE_PORT=4420
DEMS_CAPTURE_MODE=simulated
DEMS_MEDIA_DIR=/opt/dems/core/.data/media/sessions
DEMS_CAPTURE_WORKER=/opt/dems/core/apps/capture-worker/build/capture-worker
DEMS_CAPTURE_RELAY=/opt/dems/core/apps/capture-worker/build/capture-relay
DEMS_CAPTURE_GUARD=/opt/dems/core/apps/capture-worker/build/capture-guard
DEMS_CAPTURE_AUDIO_HELPER=/opt/dems/ffmpeg-9.0.2/bin/ffmpeg
ENV
stat -c '%U %G %a' /etc/dems; stat -c '%U %G %a' /etc/dems/core.env
grep -c -E '^(DEMS_CAPTURE_DEV_SOURCES|DEMS_DEMO_CONTROLS|NODE_OPTIONS)=' /etc/dems/core.env || true
grep -c -E '^(DEMS_CAPTURE_HELPER_FFMPEG|DEMS_CAPTURE_DEV_FAKE_MIC|DEMS_CAPTURE_ALIAS_SOCKET|DEMS_LCD_BACKEND_URL|DEMS_LOG_LEVEL|DEMS_PG_[A-Z_]*|PG[A-Z]*)=' /etc/dems/core.env || true
cut -d= -f1 /etc/dems/core.env
for k in WORKER RELAY GUARD; do test -x "$(sed -n "s/^DEMS_CAPTURE_$k=//p" /etc/dems/core.env)" && echo "$k exists"; done
EOF
```
**Files written.** `/etc/dems/core.env` `root:dems-core` 0640 (no secret; values from register §6.1).
**Expected.** `root root 755`; `root dems-core 640`; `0`; `0`; the seven key names; three `exists` lines. **STOP.** Any count not 0. Source: SVC §5 (table and greps); register §6.1, §11.3; HP HOST-34.

### Row 43: unit file G (SI-21; SVC §4.1; HOST-33, -35..-42, -56; E-2)

```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
install -m 0644 -o root -g root /dev/stdin /etc/systemd/system/dems-core.service <<'G'
[Unit]
Description=DEMS Core
After=network-online.target time-sync.target dems-loopback-rule.service postgresql@18-main.service
Wants=network-online.target postgresql@18-main.service
Requires=dems-loopback-rule.service

[Service]
Type=simple
User=dems-core
Group=dems-core
SupplementaryGroups=audio dems-netalias
WorkingDirectory=/opt/dems/core/apps/core-server
EnvironmentFile=/etc/dems/core.env
ExecStart=/opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/tsx/dist/cli.mjs src/index.ts
KillMode=mixed
UMask=0077
LimitCORE=0
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
G
systemd-analyze verify /etc/systemd/system/dems-core.service
systemctl daemon-reload
stat -c '%U %G %a' /etc/systemd/system/dems-core.service
systemctl show -p After -p Wants -p Requires -p LimitCORE -p NoNewPrivileges -p KillMode dems-core.service
systemctl is-enabled dems-core.service || true
EOF
```
**Files written.** File G `/etc/systemd/system/dems-core.service` root:root 0644.
**Expected.** verify prints nothing; `root root 644`; `After` holds `time-sync.target`, `dems-loopback-rule.service`, `postgresql@18-main.service`; `Wants` holds `postgresql@18-main.service`; `Requires` holds `dems-loopback-rule.service`; `LimitCORE=0`; `NoNewPrivileges=yes`; `KillMode=mixed`; `disabled`.
**Runbook choice (R18-5).** The unit is **not enabled** here. Enabling at row 43 would let the reboot of row 47 start a SIMULATED Core unobserved before row 48. Row 48 uses `systemctl start`; row 58 enables it (`enable`) after the REAL_PRODUCTION stop test, so rows 71 and 128 see the auto-start (HOST-56, AC5).
**STOP.** Any verify error. Source: SVC §4.1; HP HOST-33..42; DB §6, §7 HOST-56.

### Row 44: create, migrate, seed, status of `dems_demo` by Block O (SI-23; DB §4.4, §5, §7 HOST-55; P-01; C-18; E-11)

**Pre.** Block P disk guard. Core not started (unit inactive). Step 1 = Block K (database not yet present: tar and `core.env` only).

**Commands (Block O with C-1):**
```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
umask 077
PSQL='sudo -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -p 4432 -d postgres'
NODE=/opt/dems/node-26.12.1/bin/node
TSX=/opt/dems/core/node_modules/tsx/dist/cli.mjs
OWNER_FILE=/opt/dems/core/.data/pg.owner.env
SETS='SET log_min_error_statement TO panic; SET log_statement TO none;'
STEPS='src/db/commands/create.ts src/db/commands/migrate.ts src/db/seed/cli.ts src/db/commands/status.ts'
G='<DB §4.4 generator, verbatim as in row 41>'
close() { rm -f -- "$OWNER_FILE"; printf '%s\nALTER ROLE dems_owner PASSWORD NULL;\n' "$SETS" | $PSQL >/dev/null; }
test "$(systemctl is-active dems-core.service)" != active
test ! -e "$OWNER_FILE"
trap close EXIT
install -m 0600 -o dems-core -g dems-core /dev/null "$OWNER_FILE"
{ printf '%s\n' "$SETS"; "$NODE" --input-type=module -e "$G" "$OWNER_FILE" owner </dev/null; } | $PSQL >/dev/null
cd /opt/dems/core/apps/core-server
for step in $STEPS; do
  echo "== $step"
  sudo -u dems-core -- "$NODE" "$TSX" "$step" --database dems_demo </dev/null
done
EOF
```
(The executor pastes the generator text of row 41 in place of the `G='<...>'` line; it holds no secret.)

**VERIFY:**
```
hssh 'sudo -n bash -s' <<'EOF'
test ! -e /opt/dems/core/.data/pg.owner.env && echo owner_file_absent
sudo -u postgres psql -X -At -p 4432 -d postgres -c "SELECT rolpassword IS NULL FROM pg_authid WHERE rolname='dems_owner'"
sudo -u postgres psql -X -At -p 4432 -d dems_demo -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tableowner <> 'dems_owner'"
grep -E 'DB_SCHEMA_VERSION' /opt/dems/core/apps/core-server/src/db/schema/meta.ts | head -2
/opt/dems/node-26.12.1/bin/node -e 'console.log(require("/opt/dems/core/apps/core-server/src/db/migrations/meta/_journal.json").entries.length)'
ls /opt/dems/core/apps/core-server/src/db/migrations/*.sql | wc -l
sudo -u postgres psql -X -At -p 4432 -d dems_demo -c "SELECT (SELECT count(*) FROM session_history), (SELECT count(*) FROM active_session)"
EOF
```
**Expected.** Each `== step` reaches the next (block ends with exit 0); the status step prints `OK: dems_demo is at the schema version this code expects and the ledger matches the files`, schema version `15` and 34 ledger entries; the seed takes the named skip and prints row counts (recorded); `owner_file_absent`; `t`; `0`; `DB_SCHEMA_VERSION` line shows 15; `34`; `34`; the two session counts (recorded as the seed's numbers for rows 52, 53; HWA1 PREP-08.4). Then Block E.
**STOP.** Any non-zero step; no manual SQL repair (IMP R11). After an SSH drop during the block: re-read state with Block O `STEPS='src/db/commands/status.ts'` before any re-run (P-07; IMP R2).
Source: DB §4.4 Block O, §5, §7 HOST-54/55; P-01, P-07; C-1, C-18; E-11. The journal-count one-liner and the session-count query are this row's (unverified table semantics: `active_session` is a singleton table, so its count is 0 or 1).

### Row 45: helper absence (SI-24; HOST-44..47; C-14)

```
hssh 'sudo -n bash -s' <<'EOF'
for p in /run/dems-core-netalias/socket /run/dems-core-netalias /etc/systemd/system/dems-core-netalias.socket '/etc/systemd/system/dems-core-netalias@.service' /usr/local/sbin/dems-core-netalias /etc/dems/netalias-interface; do test -e "$p" && echo "PRESENT $p"; done; echo absence_checked
systemctl list-unit-files 'dems-core-netalias*' --no-legend | wc -l
grep -r -c netalias /etc/sudoers /etc/sudoers.d
EOF
```
**Expected.** No `PRESENT` line, then `absence_checked`; `0`; every file name followed by `:0` (HOST-47). HOST-46: N/A, helper absent; `/etc/dems/netalias-interface` absent; boot reports `NOT_ASKED` (read at rows 48/58). **STOP.** Any part present (a partial helper refuses the start: IN, HP §3.8). Source: APP:105-108; HD §7 row 45; C-14. `scripts/host/80-helper-state.sh` only prints the items and checks nothing (read: `HP_APPLY_SUPPORTED=0`), so it is not run.

### Row 122: console unit (SI-22; SVC §8.3; SEC §3; I-04)

```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
echo "data_before=$(stat -c '%U:%G %a' /opt/dems/core/.data)"
install -d -o root -g root -m 0755 /opt/dems/core/apps/core-web/node_modules
install -d -o dems-console -g dems-console -m 0700 /opt/dems/core/apps/core-web/node_modules/.vite
install -m 0644 -o root -g root /dev/stdin /etc/systemd/system/dems-console.service <<'U'
[Unit]
Description=DEMS web console (Vite development server, 127.0.0.1:5173)
After=network-online.target dems-core.service

[Service]
Type=simple
User=dems-console
Group=dems-console
WorkingDirectory=/opt/dems/core/apps/core-web
Environment=DEMS_CORE_PROXY_PORT=4420 VITE_DEMS_CORE_MODE=live HOME=/nonexistent
ExecStart=/opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/vite/bin/vite.js --configLoader runner
UMask=0077
LimitCORE=0
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
U
systemd-analyze verify /etc/systemd/system/dems-console.service
systemctl daemon-reload
systemctl enable --now dems-console.service
sleep 15
systemctl is-active dems-console.service
ss -H -ltnp 'sport = :5173' | awk '{print $4}'
ss -H -ltnp 'sport = :5173' | grep -c -E '0\.0\.0\.0|\[::\]|192\.168\.' || true
ps -o user= -p "$(systemctl show -p MainPID --value dems-console.service)"
journalctl -u dems-console.service -b --no-pager -o cat | grep -c EACCES || true
stat -c '%U:%G %a %n' /etc/systemd/system/dems-console.service /opt/dems/core/apps/core-web/node_modules/.vite
echo "data_after=$(stat -c '%U:%G %a' /opt/dems/core/.data)"
EOF
```
**Files written.** `/etc/systemd/system/dems-console.service` root 0644 (enabled); `apps/core-web/node_modules` root 0755 (if absent); `apps/core-web/node_modules/.vite` `dems-console` 0700.
**Expected.** verify silent; `active`; `127.0.0.1:5173` only; `0`; `dems-console`; `EACCES` count recorded (0 expected; a non-zero count is reported with the journal line, SVC §8.3 open point); stat lines; `.data` unchanged (SI-00c). The health probe through the proxy waits for row 49 (the Core is not running yet).
**STOP.** Any `0.0.0.0`, `[::]` or LAN address (SEC §3 item 6). Source: SVC §8.3; SEC §3; register §11.1 (`VITE_DEMS_CORE_MODE`). `sleep 15` is this row's (unverified start time of Vite).

---

### Row 46: gate G1, host profile (verifier; AC1, AC2, AC7 pre-boot)

Docs plus read-only host checks. Inputs: rows 20-45, 122, 123 artifacts; APP matrix (56 lines, PD-11-01..09). Re-run read-only: Block P, Block E, row 34 checks, row 36 VERIFY lines (`ufw status verbose`, 3702 rule count), row 40 listener checks, row 45 absence checks, and the HOST-25 counter test of row 35 **with ufw active** (H4; SEC §2.4). Output `gateway_check/01_gate_host_profile.md`: AC1 matrix PASS / N/A-with-reason per HOST item, AC2 evidence (row 40, row 44), AC7 pre-boot (ufw), each failing item routed to its row. No write on the host.

### Row 47 (HIL confirm): reboot before PREP-08

**Hand-over.**
PREPARE:
```
hssh 'sudo -n bash -s' <<'EOF'
stat -c '%U:%G %a' /etc/dems-wifi-watchdog.noreboot
timedatectl show -p NTPSynchronized --value
pgrep -c -x 'apt-get|dpkg|make|npm' || true
systemctl is-active dems-core.service; systemctl is-enabled dems-core.service
ufw status | head -1
systemctl list-timers --all --no-legend dems-ufw-revert.timer | wc -l
EOF
```
Expected `root:root 644`, `yes`, `0`, `inactive`, `disabled`, `Status: active`, `0`. The controller tells the user: "The host will reboot now. Wi-Fi is the only path back. If SSH does not return within about 5 minutes, please check the host; recovery is one SHORT tap of the power key (never a long press). Your yes for row 47?"
USER: says yes in the chat; stays reachable for the next minutes.
Executor: `hssh 'sudo -n systemctl reboot'`. First SSH attempt 180 s later; one retry 60 s after that; then `blocked` and the user checks the host.
VERIFY (after login):
```
hssh 'sudo -n bash -s' <<'EOF'
uptime -s
sysctl -n net.ipv4.ip_forward net.ipv6.conf.all.forwarding; cat /proc/sys/net/ipv4/conf/enp4s0/forwarding
timeout 300 bash -c 'until [ "$(timedatectl show -p NTPSynchronized --value)" = yes ]; do sleep 10; done'; timedatectl show -p NTPSynchronized --value
systemctl is-active time-sync.target ufw.service dems-loopback-rule.service postgresql@18-main.service dems-console.service dems-wifi-watchdog.timer
ufw status | head -1
systemctl is-active dems-core.service
EOF
```
Expected: new boot time; `0` `0` `0`; `yes` within 5 min (IMP R5); six `active`; `Status: active`; `inactive` (Core not enabled, R18-5). Plus Block P (fresh boot: wifi_fault_lines `0`).
**STOP.** NTP not `yes` after 5 min (do not edit unit ordering, IMP R5); forwarding not 0. Source: 02_structured.md row 47; IMP R5, R2; D5 (F2 no-restart rule removed).

### Row 48: SIMULATED first boot through the unit (HWA1 PREP-08 steps 2-4; AC3)

```
hssh 'sudo -n bash -s' <<'EOF'
T=$(date '+%Y-%m-%d %H:%M:%S')
systemctl start dems-core.service
sleep 30
systemctl is-active dems-core.service
journalctl -u dems-core.service --since "$T" --no-pager -o cat | grep -c 'capture fence passed'
journalctl -u dems-core.service --since "$T" --no-pager -o cat | grep -c 'SIMULATED'
journalctl -u dems-core.service --since "$T" --no-pager -o cat | grep -c -E '"level":(50|60)' || true
ss -H -ltnp | grep -E 'users:\(\("node"' | awk '{print $4}' | sort -u
ls -ld /tmp/tsx-* 2>/dev/null | awk '{print $1, $3}'
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4420/api/v1/health
# HOST-41 once: stopping the loopback rule stops the Core
systemctl stop dems-loopback-rule.service; sleep 3; systemctl is-active dems-core.service
systemctl start dems-loopback-rule.service dems-core.service; sleep 30; systemctl is-active dems-loopback-rule.service dems-core.service
EOF
```
**Expected.** `active`; `>=1`; `>=1`; error-level count recorded; listeners `127.0.0.1:4420`, `127.0.0.1:5173`, `127.0.0.1:4432` only (no other address); `/tmp/tsx-<uid>` owner `dems-core` (U1); `200` (smoke-test.sh:10 pattern); `inactive` after the rule stop (HOST-41); `active` `active`. **No session is started** (PREP-08.4).
**STOP.** Any refusal code in the journal: route per IMP R9; no second start without a change. Listener on a non-loopback address. Source: HWA1 PREP-08; SVC §4; IMP R9; HP HOST-41. The pino `level` numbers and the `ss` user filter are **(unverified)** forms.

### Row 49: console forward (OI-2; C-9) with probe

```
lsof -nP -iTCP:5173 -sTCP:LISTEN | wc -l          # Mac: 0 (port free)
ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -o ExitOnForwardFailure=yes -f -N -L 127.0.0.1:5173:127.0.0.1:5173 gsp-dems@192.168.0.73
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/
curl -s http://127.0.0.1:5173/ | grep -c -i '<title>'
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/api/v1/health
pkill -f 'L 127.0.0.1:5173:127.0.0.1:5173'                                   # stop the probe forward
hssh 'sudo -n ufw status numbered | grep -c ALLOW'                            # unchanged count
```
**Expected.** `0`; `200`; `1`; `200`; ufw rule count equal to row 36. The forward line (section 1.1) is written into `implementation/28_console_forward.md` for the user.
**STOP.** Port 5173 busy on the Mac; probe not 200. Source: register §5.3, §11.3; SEC S2; smoke-test.sh:11. `-f` background form and the `pkill` pattern are this row's (unverified).

### Row 50 (HIL): the user unassigns the four selector slots (PREP-09.2-.3)

**Hand-over.**
PREPARE: Core active (row 48 state); `T0=$(hssh 'date +%s%3N')`; baseline reads:
```
q "SELECT video_01_device_id IS NULL, video_02_device_id IS NULL, mic_primary_id IS NULL, mic_standby_id IS NULL FROM capture_config"
q "SELECT (SELECT count(*) FROM session_history), (SELECT count(*) FROM active_session)"
```
Give the user: the forward line (section 1.1), the URL `http://127.0.0.1:5173`, and this text: "Sign in as an operator who may change the capture configuration. In the device selector, unassign both video slots and both microphone slots (four actions). Then open Security & Audit and count the `CAPTURE_CONFIG_CHANGED` entries. Start no session. Tell me when done and the count you see."
USER: in the Mac browser through the forward: signs in (the seeded demonstration password is still valid at this stage; it is typed by the user, never sent to the agent), unassigns the 4 slots, reads the audit list, reports the count.
VERIFY:
```
q "SELECT video_01_device_id IS NULL, video_02_device_id IS NULL, mic_primary_id IS NULL, mic_standby_id IS NULL FROM capture_config"
q "SELECT count(*) FROM audit_log WHERE type='CAPTURE_CONFIG_CHANGED' AND at > <T0>"
q "SELECT (SELECT count(*) FROM session_history), (SELECT count(*) FROM active_session)"
```
Expected `t|t|t|t`; `4` (one per unassign action; equals the user's count); session counts equal row 44. **STOP.** Count differs (record both numbers; the controller asks the user); a session was started. Source: HWA1 PREP-09.2-.3; 02_structured.md row 50; schema `capture_config`, `audit_log` (capture.ts:253, audit.ts:34).

### Row 51 (HIL): the user switches speech-to-text off (IN §2.11; A4)

**Hand-over.** PREPARE: `T0`; `q "SELECT enabled FROM stt_config"` (expect `t` after seed). Text to the user: "In the console: System & Maintenance, Settings, Transcription (STT): switch it off and save. Tell me when done." USER: does it in the browser. VERIFY: `q "SELECT enabled FROM stt_config"` → `f`; `q "SELECT count(*) FROM audit_log WHERE type='STT_CONFIG_CHANGED' AND at > <T0>"` → `>=1`. **STOP.** Still `t`. Source: IN §2.11; schema `stt_config` (stt.ts:46); audit type name grepped in apps/core-server/src (`STT_CONFIG_CHANGED`).

### Row 52: stop the Core; `db:status`; open connections (PREP-09.4; P-07)

```
hssh 'sudo -n bash -s' <<'EOF'
systemctl stop dems-core.service; systemctl is-active dems-core.service
journalctl -u dems-core.service -n 30 --no-pager -o cat | grep -c 'shutdown complete'
sudo -u postgres psql -X -At -p 4432 -d postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname='dems_demo'"
EOF
```
Then Block O with `STEPS='src/db/commands/status.ts'` (P-07; the generator, `close()` and C-1 lines as row 44), then the two session counts (`q ...` as row 50).
**Expected.** `inactive`; `1`; `0`; the `OK: dems_demo is at the schema version ...` line; session counts equal row 44. The console may stay up (no DB connection). **STOP.** Connections > 0 after the stop (name the client by `application_name` only); status not OK. Source: HWA1 PREP-09.4; IN §2.3; P-07.

### Row 53: gate G2, pre-production (verifier; AC3)

Docs only plus read-only `systemctl is-active dems-core.service` (`inactive`). Evidence: row 48 (SIMULATED, listeners), row 50 (4 slots, 4 audits), row 51 (STT off), row 52 (Core stopped, counts). Output `gateway_check/02_gate_pre_production.md`.

### Row 54 (HIL): attended check of the hidden prompt (IN §2.4; SVC §7.2; U1, U2)

**Hand-over.**
PREPARE: confirm `systemctl is-active dems-core.service` = `inactive`; `ls -ld /tmp/tsx-*` recorded. Give the user this text and lines:
"Open your own terminal on the Mac (no recorder, no screen share). Run:
`ssh -t -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes gsp-dems@192.168.0.73`
then on the host:
`cd /opt/dems/core/apps/core-server`
`sudo -u dems-core -- /opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/tsx/dist/cli.mjs cli/secret-prompt.ts`
(1) Type a throw-away value, never a real password, then Enter. Nothing should appear while typing. (2) Type something at the shell: it must show again. (3) Start the same line again and press Ctrl-C at the prompt: the check ends and typing shows again. Tell me the three outcomes (no value)."
USER: runs it, reports three outcomes in words.
VERIFY: the three outcomes quoted; `hssh 'ls -ld /tmp/tsx-* | awk "{print \$1, \$3}"'` shows owner `dems-core` (U1). **STOP.** Any character echoed, or the terminal silent afterwards: no password is typed on this host; finding to the controller (IN §2.4). Source: IN §2.4; SVC §7.2, §7.4 U1-U2.

### Row 55 (HIL per OI-1): operator passwords (X-2; HWA1 PREP-09.5; SEC S1)

**Hand-over.**
PREPARE:
```
hssh 'sudo -n bash -s' <<'EOF'
systemctl is-active dems-core.service
sudo -u postgres psql -X -At -p 4432 -d postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname='dems_demo'"
EOF
```
Expected `inactive`, `0`. `T0` recorded. Text to the user:
"In your own `ssh -t` terminal on the host (as in row 54):
`cd /opt/dems/core/apps/core-server`
`sudo -u dems-core -- /opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/tsx/dist/cli.mjs cli/operator-set.ts --database dems_demo --data-dir /opt/dems/core/.data --all-demo`
Type `SET` when asked. Then type each operator's new password twice, the Supervisor first (12-128 printable ASCII characters; not the demonstration password, not the user name, not reused; none of the passwords from the 10-21 findings, which are burned). When it ends, run `echo $?`. Tell me the last summary line and the exit status, never a password."
USER: types `SET` and the three passwords (D6, OI-1: the user types all three); reports `operators that still have the demo password: 0` and `0`.
VERIFY: `q "SELECT count(*) FROM audit_log WHERE type='OPERATOR_PASSWORD_SET' AND at > <T0>"` → `3`. The user confirms in words that no password from the findings folder was reused (SEC §7 limit). **STOP.** `DATABASE_IN_USE` (stop clients, run again; nothing changed); exit 1 with count > 0 (the operator left empty must type later; row 58 waits). Source: IN §2.1-2.5; HWA1 PREP-09.5-.6; SVC §7.2; SEC S1, S7.

### Row 56 (HIL per OI-3): production signing key as `dems-core` (X-1; HWA1 PREP-10.1; SEC S5)

**Hand-over.**
PREPARE:
```
hssh 'sudo -n bash -s' <<'EOF'
systemctl is-active dems-core.service
test ! -e /opt/dems/core/.data/signer && echo signer_absent
namei -l /opt/dems/core/.data | awk 'NR>1{print $1, $2, $3}'
EOF
```
Expected `inactive`, `signer_absent`, ancestors root, no group/other `w` (IN §2.10). Text to the user:
"In your `ssh -t` terminal on the host:
`cd /opt/dems/core/apps/core-server`
`sudo -u dems-core -- /opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/tsx/dist/cli.mjs cli/production-key.ts --data-dir /opt/dems/core/.data`
Type the organisation name (your choice, OI-3), the installation device id exactly `DEMS-BENCH-01` (the prompt's `DEMS-JKT-07` is only an example and is refused), then `PROVISION`. Paste me the output block from `evidence:production-key: OK` to the hand-over path (it holds no secret)."
USER: runs it and pastes the OK block.
VERIFY:
```
hssh 'sudo -n bash -s' <<'EOF'
stat -c '%U %a %n' /opt/dems/core/.data/signer /opt/dems/core/.data/signer/* /opt/dems/core/.data/handover
ls /opt/dems/core/.data/signer | sed 's/.*\.//' | sort | tr '\n' ' '; echo
openssl x509 -in /opt/dems/core/.data/signer/CORE-KEY-EVSIGN-01.crt -noout -subject
openssl x509 -in /opt/dems/core/.data/signer/CORE-KEY-EVSIGN-01.crt -noout -fingerprint -sha256 | tr -d ':' | tr 'A-F' 'a-f' | sed 's/.*=//'
EOF
```
Expected: owner `dems-core` throughout, modes as the command set them (recorded); suffixes `crt p8 wrap`; subject holds `OU = Evidence signing DEMS-BENCH-01`; the fingerprint equals the `certificate: sha256` line the user pasted. The `.p8` and `.wrap` are only `stat`-ed. **STOP.** `KEY_EXISTS`, `RECORD_EXISTS`, `ROOT_REFUSED`, an `ANCESTOR_*` refusal: record the code and the three lines; no workaround (IN §2.6; HWA1 PREP-10.3). Source: IN §2.1, §2.6, §2.7, §2.10, §2.12; SVC §7.2; SEC S5. The certificate file name `CORE-KEY-EVSIGN-01.crt` follows IN §2.6 ("three files of the key id"; exact name **(unverified)**).

### Row 57: `core.env` REAL form (SI-20; I-13; HWA1 PREP-10.2)

**Pre.** Step 1 = Block K (now with `dems_demo.pgdump` and `pg_globals.sql`; signer excluded).
```
hssh 'sudo -n bash -s' <<'EOF'
set -euo pipefail
sed -i 's/^DEMS_CAPTURE_MODE=simulated$/DEMS_CAPTURE_MODE=real/' /etc/dems/core.env
grep -q '^DEMS_INSTALLATION_DEVICE_ID=' /etc/dems/core.env || printf 'DEMS_INSTALLATION_DEVICE_ID=DEMS-BENCH-01\n' >> /etc/dems/core.env
EOF
```
**Hand-over (the name, I-13).** PREPARE: the step above. Text to the user: "In your `ssh -t` terminal on the host, run this line and type the installation display name (1-120 printable characters; it is not a secret):
`sudo bash -c 'IFS= read -r -p "Installation name: " N; case "$N" in ""|*[![:print:]]*) echo refused; exit 1;; esac; [ ${#N} -le 120 ] || { echo refused; exit 1; }; grep -q "^DEMS_INSTALLATION_NAME=" /etc/dems/core.env && { echo exists; exit 1; }; printf "DEMS_INSTALLATION_NAME=%s\n" "$N" >> /etc/dems/core.env; echo written'`
Tell me the word it printed." USER: types the name; reports `written`.
VERIFY:
```
hssh 'sudo -n bash -s' <<'EOF'
stat -c '%U %G %a' /etc/dems/core.env
grep -c '^DEMS_CAPTURE_MODE=real$' /etc/dems/core.env
grep -c '^DEMS_INSTALLATION_DEVICE_ID=DEMS-BENCH-01$' /etc/dems/core.env
grep -c -E '^DEMS_INSTALLATION_(DEVICE_ID|NAME)=' /etc/dems/core.env
awk -F= '/^DEMS_INSTALLATION_NAME=/{print length(substr($0, 24))}' /etc/dems/core.env
grep -c -E '^(DEMS_CAPTURE_DEV_SOURCES|DEMS_DEMO_CONTROLS|NODE_OPTIONS)=' /etc/dems/core.env || true
grep -c -E '^(DEMS_CAPTURE_HELPER_FFMPEG|DEMS_CAPTURE_DEV_FAKE_MIC|DEMS_CAPTURE_ALIAS_SOCKET|DEMS_LCD_BACKEND_URL|DEMS_LOG_LEVEL|DEMS_PG_[A-Z_]*|PG[A-Z]*)=' /etc/dems/core.env || true
EOF
```
Expected `root dems-core 640`; `1`; `1`; `2`; a length 1-120; `0`; `0`. **STOP.** Any count differs. **Rollback.** IMP R9 sed block (back to SIMULATED). Source: SVC §5; register §6.1, §9; IN §2.12; D16 I-13. The read-and-append line is this row's (unverified; it prints only a word).

### Row 58: first REAL_PRODUCTION boot; stop test; enable (SI-21, SI-25; AC5; E-13; IMP R9, R10)

**Pre.** Block P (NTP `yes`, flag present); Core inactive.
```
hssh 'sudo -n bash -s' <<'EOF'
T=$(date '+%Y-%m-%d %H:%M:%S'); echo "start=$T"
systemctl start dems-core.service; sleep 45
systemctl is-active dems-core.service
journalctl -u dems-core.service --since "$T" --no-pager -o cat | grep -c 'REAL_PRODUCTION'
journalctl -u dems-core.service --since "$T" --no-pager -o cat | grep -c 'CAPTURE_HOST_ALIAS_HELPER_ABSENT'
journalctl -u dems-core.service --since "$T" --no-pager -o cat | grep -o -E '"code":"[A-Z_]+"' | sort | uniq -c
systemctl show -p ExecStart --value dems-core.service | grep -o 'argv\[\]=[^;]*'
ls -ld /tmp/tsx-* | awk '{print $1, $3}'
ss -H -ltnp | awk '{print $4}' | sort -u
EOF
q "SELECT details->>'addressHelperSocket' FROM audit_log WHERE type='SYSTEM_BOOT' ORDER BY seq DESC LIMIT 1"
```
Expected: `active`; `>=1`; `1` (warning, helper absent); the code histogram recorded (no refusal code); ExecStart = form A recorded; `/tmp/tsx-*` owner `dems-core` (H6); listeners all `127.0.0.1:*`; `NOT_PRESENT`.
STOP on a refusal: `journalctl -u dems-core.service -b --no-pager -o cat | tail -40`, route per IMP R9 (`CAPTURE_SIGNING_KEY_*` to row 56, `INSTALLATION_IDENTITY_NOT_CONFIGURED` / `CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH` to row 57, `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` to row 55, `TRANSCRIBER_CONFIG_UNRESOLVABLE` to row 51, `FOREIGN_DATABASE_PORT` to row 40, host checks to their HOST row). Forbidden: deleting or re-provisioning the signer, `evidence:dev-key`, adding a key the register marks absent, a second start without a change.

**Idle stop test (R10), then enable:**
```
hssh 'sudo -n bash -s' <<'EOF'
T=$(date '+%Y-%m-%d %H:%M:%S')
systemctl stop dems-core.service
journalctl -u dems-core.service --since "$T" --no-pager -o cat | grep -c 'shutdown complete'
journalctl -u dems-core.service --since "$T" --no-pager -o cat | grep -c 'second signal during shutdown; forcing exit' || true
EOF
```
Expected `1` and `0`. Then:
```
hssh 'sudo -n systemctl enable --now dems-core.service; sleep 45; systemctl is-enabled dems-core.service; systemctl is-active dems-core.service'
```
Expected `enabled`, `active`; then Block E.
**Fallback (IMP R10, I-02):** if the stop test fails: no recording row and no reboot with the Core enabled until form B passes the same test.
```
K=<install_backup_dir of row 57>
sudo cp -a /etc/systemd/system/dems-core.service "$K"/dems-core.service.formA
sudo sed -i -e 's#^ExecStart=.*#ExecStart=/opt/dems/node-26.12.1/bin/node --import tsx src/index.ts#' -e '/^KillMode=mixed$/d' /etc/systemd/system/dems-core.service
sudo systemd-analyze verify /etc/systemd/system/dems-core.service && sudo systemctl daemon-reload
```
then repeat start, checks and stop test; record the form in decisions (PD-11-06). Source: SVC §4; IMP R9, R10; HWA1 PREP-12.2; IN §2.11. The `"code":"..."` JSON form of the journal lines is **(unverified)**.

### Row 59: unit hardening via both pids (test-expert; HOST-24, -35, -36, -38..-40, -42, -07, -08, -49; PD-11-04, PD-11-08)

```
hssh 'sudo -n bash -s' <<'EOF'
M=$(systemctl show -p MainPID --value dems-core.service); C=$(pgrep -P "$M" | head -1); echo "pids=2 children=$(pgrep -P "$M" | wc -l)"
for p in "$M" "$C"; do
  echo "== $([ "$p" = "$M" ] && echo parent || echo child)"
  grep 'Max core file size' /proc/$p/limits | awk '{print $5, $6}'
  tr '\0' '\n' < /proc/$p/cmdline | grep -c -E '^--(report|diagnostic|heap|inspect)' || true
  tr '\0' '\n' < /proc/$p/environ | grep -c '^NODE_OPTIONS=' || true
  grep NoNewPrivs /proc/$p/status | awk '{print $2}'
  grep -E '^Cap(Prm|Eff|Bnd|Amb)' /proc/$p/status | awk '{print $2}' | sort -u
  grep '^Groups:' /proc/$p/status | cut -f2
  grep '^Umask:' /proc/$p/status | awk '{print $2}'
done
getent group audio dems-netalias | cut -d: -f3 | tr '\n' ' '; echo
systemctl show -p LimitCORE -p NoNewPrivileges dems-core.service
ss -H -ltnp | grep -E '"(node|postgres)"' | awk '{print $4}' | sort -u
ufw status | grep -c -E '^(442[0-3]|4432|5173)[/ ].*ALLOW' || true
find /opt/dems/core/.data/run -type d ! -perm 700 2>/dev/null | wc -l
journalctl -u dems-core.service -b --no-pager -o cat | grep -c -i 'prerequisite' || true
EOF
```
**Expected.** One child; both pids: `0 0` (HOST-35), `0`, `0` (HOST-36), `1` (HOST-38), one value `0000000000000000` (HOST-39), the two gids of `audio dems-netalias` (HOST-40), `0077` (HOST-42); `LimitCORE=0`, `NoNewPrivileges=yes`; listeners `127.0.0.1` only incl. 4420, 4432, 5173 (HOST-24 + PD-11-04); `0` ALLOW; `0` (HOST-08 dir part); `0` (HOST-49 read part). **STOP** is not this row's: a FAIL is routed to row 43/58 by gate 60. Source: HP HOST-35..42, -24, -08, -49; SVC §4.5; APP PD-11-04, -08. The `prerequisite` grep is a reading aid **(unverified)** wording.

### Row 60: gate G3 (verifier; AC4, AC5)

Docs only. Evidence rows 54-59: the summary line and `OPERATOR_PASSWORD_SET` count 3; OK block, OU, fingerprint; journal `REAL_PRODUCTION`; `SYSTEM_BOOT` `NOT_PRESENT`; stop test; ExecStart form. Output `gateway_check/03_gate_production_boot.md`.

### Row 61: certificate fingerprint record

Docs only: copy the 64-hex `certificate: sha256` from row 56 into `implementation/37_fingerprint_record.md` with status "not handed over" (IN §2.7: the hand-over is the user's, after the first production boot, by another channel). Check: equals row 56 VERIFY fingerprint.

### Row 124: capture network configuration: N/A record (E-9; Q96-16 a)

Docs only, `sonnet`, deps `60:B`. Write `implementation/71_network_config.md`: "N/A: under Q96-04 (a) set-IP and scan stay bound and the helper is absent; there is no factory-default camera to re-address (D16 Q96-16 a; SHEET:138). 9A/H-12 steps .3-.4 are recorded 'not run' with this reason. No `CAPTURE_CONFIG_CHANGED` for the network config is expected." Read-only evidence: `q "SELECT count(*) FROM capture_network_config"` (recorded).

---

### Rows 62-65 (HIL, PREP-13): camera pages CAM-A..D (SI-26; D8 F7; I-14; SEC S4)

One section, run four times in order: CAM-A = `192.168.100.101` (port 18101), CAM-B = `.102` (18102), CAM-C = `.103` (18103), CAM-D = `.117` (18117).

**Hand-over (per camera).**
PREPARE:
```
hssh 'bash -s' <<'EOF'
ip -br link show enp4s0 | awk '{print $2}'
ip -br -4 addr show dev enp4s0 | awk '{print $3}'
ip route get 192.168.100.101 | grep -o 'dev [^ ]* src [^ ]*'
for a in 101 102 103 117; do timeout 2 bash -c "</dev/tcp/192.168.100.$a/554" 2>/dev/null && echo ok $a; done
for a in 101 102 103 117; do timeout 2 bash -c "</dev/tcp/192.168.100.$a/80" 2>/dev/null && echo web $a; done
timedatectl show -p NTPSynchronized --value
EOF
```
Expected `UP`, `192.168.100.254/24`, `dev enp4s0 src 192.168.100.254`, four `ok`, four `web` (register G3: port 80 hypothesis), `yes` (IMP R4, R5). Give the user the camera-page forward line (section 1.1, run in the user's own terminal or by the executor with `-f`) and this text:
"Open `http://127.0.0.1:181xx` for this camera. (1) Change the account password on the camera's own page (not one from the 10-21 findings; the user name has no colon). (2) If the page has a stream authentication setting, set Digest. (3) Set the camera clock to the host time; compare with the time I give you. (4) Fill the camera's line of the per-camera sheet (HWA1 §9.3) without any password. Tell me: done, the clock difference you saw, colon/Digest notes."
USER: does steps 1-4 in the Mac browser.
VERIFY: `hssh 'date "+%H:%M:%S"'` read out at the user's clock step; the user's reported difference under 2 s; the sheet line exists with every column filled and no password (the executor reads the sheet if it is in the task folder; scan of section 1.2 passes); colon/Digest notes recorded. Executor never sees or stores the password.
**STOP.** Camera LAN check fails (IMP R4: never edit the NM profile); NTP not `yes`; port 80 closed (record; ask the user for the camera's web port). Source: HWA1 PREP-13; register §5.3, §11.3; SEC S4; IMP R4, R5.

### Rows 66-69 (HIL, 9A/H-12 .1-.2 and 9A/H-10): global search and adoption CAM-A..D (SI-26; E-8; C-17; IMP R12)

Run in order CAM-A, CAM-B, CAM-C, CAM-D. Precondition for row 66 (IMP R12 stop rule as updated by C-15): gate row 119 recorded the user's posture confirmation; D16 answered Q96-04..Q96-08.

**Hand-over (per camera).**
PREPARE: Block P; the row 62-65 PREPARE checks; `T0`;
```
hssh 'sudo -n ufw status numbered | grep 3702'                        # 9A/H-12.1
hssh 'ip -br -4 addr | awk "{print \$1, \$2}"'                         # interfaces with IPv4 (eligibility read in row 66)
```
Text to the user: "Through the console forward: (row 66 only) run the camera search with no typed address and tell me the line 'Searched N networks.' and the number of candidates. Then for this camera: choose its candidate, open the connect flow, type the account and the NEW password you set in its page, start the test, read the outcome and profiles; adopt it. CAM-A: assign its first profile to video slot 1; CAM-B: to video slot 2; CAM-C and CAM-D: adopt only. Do not adopt any device that is not one of the four camera addresses. Tell me: outcome word, N, candidate count."
USER: in the Mac browser; types the camera credential in the console only.
VERIFY:
```
q "SELECT id, kind, adapter_kind, address, enabled, retired_at IS NULL FROM capture_devices WHERE kind='CAMERA' AND retired_at IS NULL ORDER BY id"
q "SELECT d.address, count(c.*) FROM capture_devices d LEFT JOIN capture_device_credentials c ON c.device_id = d.id WHERE d.kind='CAMERA' AND d.retired_at IS NULL GROUP BY d.address ORDER BY 1"
q "SELECT type, count(*) FROM audit_log WHERE at > <T0> GROUP BY type ORDER BY 1"
q "SELECT video_01_device_id, video_02_device_id FROM capture_config"
```
Expected: the camera listed (address `192.168.100.1xx`, `adapter_kind` not `FAKE`, enabled); one credential row per adopted camera (count only); audit types and counts recorded (adoption and connection-test entries); slots per the text (CAM-A, CAM-B). Row 66: `N` = `interfaceCount` recorded; expected `2` (enp4s0 and wlp3s0; H-3) and compared with the IPv4 interface list read above; any other value is recorded with the list (not a STOP unless `N=0`). After row 69 (IMP R12):
```
hssh 'sudo -n bash -s' <<'EOF'
ss -H -tnp state established '( dport = :80 or dport = :554 )' | grep -E '"node"' | awk '{print $3}' | sed 's/:[0-9]*$//' | sort -u
sysctl -n net.ipv4.ip_forward net.ipv6.conf.all.forwarding
ufw status numbered | grep 3702 | grep -v -c -e 'on enp4s0' -e 'on wlp3s0' || true
EOF
```
Expected: only `192.168.100.254`; `0` `0`; `0` (no 3702 rule beyond the camera port and the Wi-Fi port, D33 M-6).
**STOP.** A candidate or connection that names `wlp3s0` or an address outside 192.168.100.0/24 is not adopted (stop, report: IMP R12); camera-LAN link-down in `journalctl -k --since <row start>`; `N=0`. Source: HWA3 9A/H-12 (.1, .2), 9A/H-10 (.1-.5); SPEC-RF §2.8, §7; HD §7 rows 66-69; IMP R4, R12. Console text "Searched {{count}} networks." from `common.ts:778-779` (`camera-search-panel.tsx:256`). Slot assignment of CAM-A/CAM-B follows 9A/H-10.5 (R18-6).

### Row 125 (HIL, AC9): bind the USB mic (SI-27; SPEC-RF §7; I-18)

**Hand-over.**
PREPARE (the user is at the bench; I-18; no session is recorded in rows 125-127):
```
hssh 'sudo -n bash -s' <<'EOF'
grep -c 'USB-Audio - BOMGE USB AUDIO' /proc/asound/cards
N=$(awk '/USB-Audio - BOMGE USB AUDIO/{print $1}' /proc/asound/cards); udevadm info -q path -n /dev/snd/controlC$N | grep -o '/usb[0-9]*/[0-9.-]*/' | tail -1
EOF
q "SELECT count(*) FROM capture_audio_inputs WHERE retired_at IS NULL"
```
Expected `1`, the USB port path (recorded; 03_ D2 says port `1-1`), live input count recorded. `T0`. Text to the user: "In the console, audio cards: search the sound cards, register input 1 of BOMGE USB AUDIO as a microphone, then assign it to the PRIMARY microphone line. Then search the cards again: the card should show 'Bound to MIC-nn' and offer no new registration. Tell me the MIC id and what the card shows."
USER: does it in the browser; reports.
VERIFY:
```
q "SELECT device_id, input_number, usb_serial IS NULL, usb_port, retired_at IS NULL FROM capture_audio_inputs WHERE retired_at IS NULL ORDER BY device_id"
q "SELECT mic_primary_id, mic_standby_id FROM capture_config"
q "SELECT type, details->>'change', device_id FROM audit_log WHERE at > <T0> AND type IN ('CAPTURE_AUDIO_INPUT_CHANGED','CAPTURE_CONFIG_CHANGED') ORDER BY seq"
```
Expected: one live row with the user's MIC id, `usb_serial IS NULL` = `t`, `usb_port` = the recorded port; `mic_primary_id` = that MIC; audit entries for the registration and the slot change; the user's words "Bound to MIC-nn", not offered (AU-L1 `boundTo`). **STOP.** Card not listed; two live rows for the card. Source: SPEC-RF §5.1, §7 (AC9 row 125); R-FLEX register AU-L1, OP-98, OP-99; schema `capture_audio_inputs` (capture.ts:429). `udevadm` path parsing **(unverified)**.

### Row 126 (HIL, AC9): re-bind PRIMARY to STANDBY (selector move; Q-R5 B)

**Hand-over.** PREPARE: `T0`; `q "SELECT mic_primary_id, mic_standby_id FROM capture_config"` (expect MIC, empty). Text: "In the microphone lines, choose the same MIC for the STANDBY line ('on the primary line - choose to move it here'). PRIMARY should then show 'Not assigned'. Tell me what both lines show." USER: does it. VERIFY: `q "SELECT mic_primary_id IS NULL, mic_standby_id FROM capture_config"` → `t|MIC-nn`; audit `CAPTURE_CONFIG_CHANGED` count since `T0` `>=1`; live input count unchanged. The op-99 release to another input (`RELEASED` then `REENABLED`, `releasedDeviceId`) is not reachable on a one-input card and is proven by DB test T-10 at row 115 (cite `test/04_rflex_regression.md`). **STOP.** PRIMARY still holds the MIC; T-13 outcome (row 132) said the move is refused: report. Source: SPEC-RF §5.1 (selector move, T-13), §6.2, §7.

### Row 127 (HIL, AC9): move the mic to another USB port

**Hand-over.** PREPARE: no session running (`q "SELECT count(*) FROM active_session"` → `0`); old port recorded (row 125); `T0=$(hssh 'date +%s%3N')`, `TJ=$(hssh "date '+%Y-%m-%d %H:%M:%S'")`. Text: "Unplug the BOMGE mic and plug it into another USB port of the host. Wait 10 s. In the console audio cards: search the cards; register input 1 of the card again (it should answer as re-enabled, same MIC id). Tell me the MIC id and the answer you saw." USER: at the bench, moves the plug; acts in the console.
VERIFY:
```
hssh 'sudo -n bash -s' <<'EOF'
N=$(awk '/USB-Audio - BOMGE USB AUDIO/{print $1}' /proc/asound/cards); udevadm info -q path -n /dev/snd/controlC$N | grep -o '/usb[0-9]*/[0-9.-]*/' | tail -1
journalctl -u dems-core.service --since "<TJ>" --no-pager -o cat | grep -c AUDIO_CARD_CHANGED || true
EOF
q "SELECT device_id, usb_port, retired_at IS NULL FROM capture_audio_inputs WHERE retired_at IS NULL ORDER BY device_id"
q "SELECT details->>'change', device_id FROM audit_log WHERE at > <T0> AND type='CAPTURE_AUDIO_INPUT_CHANGED' ORDER BY seq"
q "SELECT mic_standby_id FROM capture_config"
```
Expected: a new port path differing from row 125; `0` (no `AUDIO_CARD_CHANGED`); one live row, same MIC id, `usb_port` refreshed (informational, Q96-09 a); an audit `change` `REENABLED` for that MIC; `mic_standby_id` unchanged. **STOP.** A new MIC id minted; `AUDIO_CARD_CHANGED` present. Source: SPEC-RF §5.1 (op 99 step 2, `usb_port` informational), §7 (AC9 row 127); R-FLEX register AU-A1.

### Row 70: camera-LAN host-hygiene invariants before the final reboot (SI-28; AC6 "before")

Read-only: the row 34 commands plus `sysctl -n net.ipv4.ip_forward net.ipv6.conf.all.forwarding` and `cat /proc/sys/net/ipv4/conf/enp4s0/forwarding`. Expected as row 34 and `0 0 0`. Output kept for comparison by row 71. Source: HD §7 row 70, §8 AC6.

### Row 71 (HIL confirm): final reboot with AC6 checks (SI-28; AC5, AC6)

**Hand-over.**
PREPARE: Block K (Core must be stopped for the backup: `hssh 'sudo -n systemctl stop dems-core.service'`, then Block K, then `sudo systemctl start dems-core.service`; R10 passed at row 58); Block P (NTP `yes`, flag present); `q "SELECT count(*) FROM active_session"` → `0` (no recording). Text: "The host reboots now; the Core and console should come back by themselves. Recovery if SSH does not return in about 5 minutes: one SHORT power-key tap. Your yes for row 71?" USER: yes in the chat; stays reachable.
Executor: `hssh 'sudo -n systemctl reboot'`; SSH attempts as row 47.
VERIFY:
```
hssh 'sudo -n bash -s' <<'EOF'
uptime -s
sysctl -n net.ipv4.ip_forward net.ipv6.conf.all.forwarding; cat /proc/sys/net/ipv4/conf/enp4s0/forwarding
ip -br -4 addr show dev enp4s0 | awk '{print $3}'; ip -4 route show default | grep -c enp4s0 || true
nmcli -g ipv4.gateway,ipv4.dns,ipv4.never-default connection show "DEMS Camera LAN"
timeout 300 bash -c 'until [ "$(timedatectl show -p NTPSynchronized --value)" = yes ]; do sleep 10; done'; timedatectl show -p NTPSynchronized --value
sleep 60; systemctl is-active postgresql@18-main.service dems-core.service dems-console.service ufw.service
journalctl -u dems-core.service -b --no-pager -o cat | grep -c REAL_PRODUCTION
journalctl -u dems-core.service -b --no-pager | grep -c -i -E 'ECONNREFUSED|could not connect|pg_hba' || true
systemd-analyze critical-chain dems-core.service | grep -c postgresql@18-main.service
EOF
q "SELECT count(*) FROM audit_log WHERE type='CAPTURE_DEVICE_UNREACHABLE' AND at > (extract(epoch from now()) * 1000 - 600000)"
```
Expected: new boot; `0 0 0`; `192.168.100.254/24`, `0`; empty gateway/DNS, `yes`; `yes`; four `active` (no manual start: HOST-56, AC5); `>=1`; `0`; `1`; `0` unreachable in the last 10 min, and the user confirms 4 cameras connected in the console (AC6). Then Block E.
**STOP.** Core not active; forwarding not 0; a camera unreachable (IMP R4). Source: HD §8 AC6; DB §7 HOST-56; IMP R5, R10; SI-28. The time window of the unreachable query is this row's (unverified audit semantics).

### Row 72: external reachability from the Mac over Wi-Fi (test-expert; AC7; SI-33; I-10)

```
ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -o BatchMode=yes -o ControlMaster=no -o ControlPath=none -o ConnectTimeout=15 gsp-dems@192.168.0.73 'echo ssh_ok'
for p in 4420 4421 4422 4423 5173 4432 $(seq 8554 8564); do nc -z -G 3 192.168.0.73 $p 2>/dev/null && echo "OPEN $p"; done; echo probe_done
hssh 'sudo -n ufw status numbered | grep -c 3702; sudo -n ufw status numbered | grep 3702 | grep -c "on enp4s0"; sudo -n ufw status numbered | grep 3702 | grep -c "on wlp3s0"'
```
**Expected.** `ssh_ok`; no `OPEN` line, then `probe_done`; `2` `1` `1` (D33 M-6; doubled if `IPV6=yes`). An ICMP echo answer is not a breach (I-10). **STOP** n/a (test row): any `OPEN` is a FAIL routed to rows 36/40/122. Source: HD §7 row 72; SEC §2.4. macOS `nc -G` (connect timeout) **(unverified)** on this Mac.

### Row 73: resource baseline (test-expert; P-19)

```
hssh 'bash -s' <<'EOF'
df --output=pcent,avail -h / | tail -1
free -m | awk '/^Mem:/{print $7}'
cut -d' ' -f1-3 /proc/loadavg
M=$(systemctl show -p MainPID --value dems-core.service); C=$(pgrep -P "$M" | head -1); ps -o rss= -p "$M","$C" | awk '{s+=$1} END {print s}'
EOF
```
Four figures: used % and free space of `/` (free must stay above 20 %), available memory MiB, load averages, Core RSS KiB (parent + child). Source: IMP R6; P-19. Commands are this row's (unverified selection of figures).

### Row 128: R-FLEX after the final reboot (test-expert; SI-28; E-8; AC9)

```
q "SELECT mic_primary_id IS NULL, mic_standby_id FROM capture_config"
q "SELECT device_id, retired_at IS NULL FROM capture_audio_inputs WHERE retired_at IS NULL"
hssh "sudo -n journalctl -u dems-core.service -b --no-pager -o cat | grep -c AUDIO_CARD_CHANGED || true"
q "SELECT count(*) FROM capture_devices WHERE kind='CAMERA' AND retired_at IS NULL"
```
Expected: `t|<MIC id of row 126>`; the same single MIC row; `0`; `4`. **The search part needs the user** (R18-7): hand-over text "Run the camera search with no typed address; tell me 'Searched N networks.' and the candidate count." Expected `N` = the row-66 value; 4 cameras listed. Source: SPEC-RF §7; E-8.

---

### Row 74: verify AC1-AC9 (verifier)

Docs only. Map each AC to the evidence paths of `01_specs.md` §5 (AC1: rows 21-45, 59, gate 46; AC2: 39, 40, 44; AC3: 48-53; AC4: 54-56, 60, 61; AC5: 57-60, 71; AC6: 33, 34, 62-71; AC7: 36, 72; AC8: row 78; AC9: 66-69, 115 (T-10), 125-128). Out-of-scope checks "not run" with reason (9A/H-12 .3-.4: Q96-16; second mic: U-RF5). Output `verification/01_verification.md`.

### Row 75: security review of secret hygiene with the deployed posture (security-review)

- Section 1.2 scan over the whole task folder (C-1 pattern). Pass = no file listed; a hit is inspected masked (SEC §7).
- Host modes, read-only: `sudo stat -c '%U:%G %a %n' /opt/dems/core/.data /opt/dems/core/.data/pg.env /etc/dems/core.env /etc/systemd/system/dems-core.service /etc/systemd/system/dems-console.service /home/gsp-dems/dems-host-baseline-* /home/gsp-dems/dems-install-backup-*`; `sudo test ! -e /opt/dems/core/.data/pg.owner.env`; `rolpassword IS NULL` for `dems_owner`.
- Posture: `ufw status verbose`, `ufw status numbered`, forwarding `0 0 0`, listeners, equal to `verification/06_rflex_security.md` (row 117) and HD E-P3.
Output `verification/02_security.md`.

### Row 76: configuration review (senior-code-reviewer)

Read-only diff of each installed artifact against its spec text: `sudo cat` of files A, C, D, E, G, console unit, `pg_hba.conf` non-comment lines (these hold no secret) vs HP §4 / SVC §4.1, §8.3 / DB §3.2; `core.env` **key names only** (`cut -d= -f1`) vs SVC §5; HOST-23 rule scope; NM profile fields vs file B (A8 / E-P4b); HOST-24 port list. Deviations listed with D-id/PD-id. Output `verification/03_config_review.md`.

### Row 77: rollback readiness (verifier; E-17; SI-31)

```
hssh 'sudo -n bash -s' <<'EOF'
B=$(ls -d /home/gsp-dems/dems-host-baseline-*); cd "$B" && sha256sum -c --quiet SHA256SUMS.baseline && echo baseline_ok
for K in /home/gsp-dems/dems-install-backup-*; do (cd "$K" && sha256sum -c --quiet SHA256SUMS && echo "ok $(basename "$K")"); done
test -f "$B"/etc/ufw/ufw.conf && test -f "$B"/etc/default/ufw && echo c3_paths_present
EOF
cd /Users/gsp-budi/Documents/DEMS/.data/rflex-restore-20261022 && shasum -a 256 -c SHA256SUMS
cd /Users/gsp-budi/Documents/DEMS && patch -R -E -p1 --dry-run < .data/rflex-restore-20261022/rflex-only.diff >/dev/null && echo reverse_patch_dry_run_ok
```
Expected `baseline_ok`, one `ok` per backup, `c3_paths_present`, all `OK` lines for the restore folder (run inside the folder: SPEC-RF §9.1 correction), `reverse_patch_dry_run_ok` (RF-P2). Each stage has a rollback block: IMP §6 with C-3 paths, INSTALL-R-A (IMP §7.1, without `netplan apply` and without unmask, E-5), R-FLEX-R-B (no DB step, P-02). Output `verification/04_rollback_readiness.md`.

### Row 78: deviation and refusal-code register (data-analyst)

Docs only. Every D-id/PD-id of `01_specs.md` §7, plus R18-n items of this file that row 19 accepts, plus every refusal code met at rows 48 and 58 (IMP R9) and the R-FLEX code additions/removals (R-FLEX register §3). Output `decisions/01_deviation_register.md`.

### Row 79: final report (document-writer)

Docs only. AC1-AC9 table with evidence paths; R-FLEX posture and residual guards (RG-1..RG-14, D11); continuation point INSTALLER-NOTE step 11; open items (I-11 user action, fingerprint hand-over, second mic U-RF5). No secret. Output `report/report.md`.

## 4. Rollback references (where each block lives)

| Scope | Block | Notes |
|---|---|---|
| Per stage | IMP §6 table | Read every `<REQ:...>` with register §11.1 values; baseline paths `<B>/etc/...` (C-3) |
| ufw | IMP R1 rollback with C-3 paths | row 36 section |
| PostgreSQL | IMP R11 a-c (remove, never purge; dump first by Block K) | d) cluster deletion only on the user's word |
| Core form | IMP R10 (form A/B) | row 58 section |
| REAL to SIMULATED | IMP R9 | row 57 section |
| Whole install | INSTALL-R-A, IMP §7.1, minus `netplan apply` and unmask (E-5); step 4 copies `<B>/etc/ufw/ufw.conf` | D16 I-19 |
| R-FLEX code | R-FLEX-R-B, reverse `rflex-only.diff`, no DB step (P-02) | D16 Q96-18 |
| Docker restore | not planned (D16 I-20) | IMP §7.3 reference only |

## 5. HIL summary (what the user does)

| Row | USER action | Where | Typed by the user | Agent never |
|---|---|---|---|---|
| 36 | yes to enable ufw | chat | - | enables before the quoted yes |
| 41 | none (OI-4 B); may stop the row | chat | - | prints or stores a role secret |
| 47, 71 | yes to reboot; stay reachable | chat | - | power-cycles; long-presses |
| 50 | unassign 4 slots; count audits | Mac browser (forward) | sign-in password | sees the password |
| 51 | STT off | Mac browser | - | changes stored config directly |
| 54 | attended check, throw-away value | own `ssh -t` terminal | throw-away value | holds that terminal |
| 55 | `SET` + 3 operator passwords | own `ssh -t` terminal | passwords | types for an operator |
| 56 | organisation, `DEMS-BENCH-01`, `PROVISION` | own `ssh -t` terminal | non-secret values | runs the key command |
| 57 | installation display name | own `ssh -t` terminal | non-secret name | chooses the name |
| 62-65 | camera password, Digest, clock, sheet line | Mac browser (camera forward) | camera passwords | sees a camera password |
| 66-69 | search; connect; adopt; slots for CAM-A/B | Mac browser (forward) | camera credential | adopts a non-camera device |
| 125-127 | bind; selector move; USB port move; re-register | at the bench + Mac browser | - | records a session |
| 128 | search after reboot (R18-7) | Mac browser | - | - |

## 6. Requests for row 19 (MINOR proposals; row 19 classifies)

| Id | Request | Why |
|---|---|---|
| R18-1 | Row 25: add `22:B` (needs `/opt/dems` root 0755) | Row 25 depends only on 24 and 8; `/opt/dems` is made by row 22 |
| R18-2 | Long rows 24, 27, 28, 29, 30 run as `systemd-run --unit=dems-host-build-row<NN> --collect` with log and exit files under `/var/log/dems-host-build-row<NN>.*` (row 28 log in `ffmpeg_build_dir`) | SI-00g; register §11.1 `host_build_unit`. The log/exit file paths are new (not register names); row 19 may ask the register to add them or accept them as runtime files |
| R18-3 | Row 26 copy form gains `--no-overwrite-dir` and a post-copy `stat` of `/opt/dems/core` | IMP R8's form archives `./` with the staging folder's 0700 mode; extraction would re-mode the install dir |
| R18-4 | Rows 30/31 verification text: relay "states the library version" read as `ldd` + `make versions`; guard: "links no FFmpeg library" instead of "states library version" | research/01_explore_capture_build.md §2: the guard links no library |
| R18-5 | Row 43 does not enable the unit; row 58 enables it after the stop test | Prevents an unobserved SIMULATED auto-start at the row-47 reboot; AC5 is still proven at row 71 |
| R18-6 | Rows 66/67 assign CAM-A/CAM-B profiles to video slots 1/2 (9A/H-10.5); rows 68/69 adopt only | Two video slots; HWA3 9A/H-10 |
| R18-7 | Row 128 needs `user-terminal` for the camera search (test-expert cannot sign in) | The search answer is seen only in the signed-in console |
| R18-8 | Row 41 "HIL" is notify-only under OI-4 B | DB §4.4: no user input |
| R18-9 | Row 24 package set adds `gnupg curl ca-certificates xz-utils` | Needed by rows 25, 28, 39 (DB §7 HOST-50 names three of them) |
| R18-10 | Block K inside rows 44, 57, 71 (E-12 choice) | Fewer rows; the backup is the row's first step |
| R18-11 | Row 39 carries the H-2 pre-check (`pg_dumpall --help` lists `--no-role-passwords`) with a STOP that reaches the controller before row 44 | 01_specs.md P-06, H-2 |

## 7. Commands marked (unverified), collected

`gpgv --keyring <kbx> --status-fd 1` and the README's own verification line (row 25); `tar --strip-components=1` layout of the Node archive (25); `tar --no-overwrite-dir` effect on `.` (26); the manifest function (26); `systemd-run` wrappers with quoted inner commands (24, 27, 28, 29, 30); FFmpeg `-L` and `-devices` output greps (28); `nmcli -g` field names (34, 71); nft rule regex (35); `loginctl` column, `/dev/snd/by-id` glob, `/proc/asound/cards` awk (37); keyserver URL, `createcluster.conf` sed, `pg_dumpall --help` grep (39); `default_transaction_read_only` via `PGOPTIONS` and `audit_log.at` in epoch ms (Block Q); Block K's combined form (`if` guard, `umask`); journal JSON forms (`"level":`, `"code":`) (48, 58); `sleep` waits (48, 58, 71, 122); certificate file name (56); name read-and-append line (57); `udevadm` port parsing (125, 127); macOS `nc -G` (72); the row-73 figure selection; the row-71 unreachable window.

## 8. Risks, assumptions, gaps of this runbook

| # | Item | Status | Owner |
|---|---|---|---|
| G-1 | No command here has run on .73; output forms are from specs or tool knowledge | stated per row | executors record actual output |
| G-2 | PostgreSQL paths and unit names (H-1), `--no-role-passwords` (H-2) | hypotheses | row 39 |
| G-3 | `interfaceCount` = 2 (H-3) | hypothesis | row 66 |
| G-4 | Port 80 on the cameras (register G3) | hypothesis | rows 62-65 PREPARE |
| G-5 | Row 121's manifest form not known to this row | row 26 recomputes both sides on the host | row 26 |
| G-6 | Node signature trust anchor is the GitHub keyring (W11) | recorded deviation | row 25, row 78 |
| G-7 | Brief statement "26.12.1 checksum is NOT in row 8's file": the file holds the line "for reference only" (research/02_collection_node.md §2) and register §7.1 cites it; the runbook gates on the signed list fetched on the host and uses the register line only as a cross-check | discrepancy noted | controller |
| R-1 | An executor copies IMP or SEC blocks instead of this file | this file cites them and states the corrections (C-1..C-20, R18-3) | executors |

## 9. Verification of this file (row 18 checks)

- Every row 20-79 and 122-128 has a section: 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62-65, 66-69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 122, 123, 124, 125, 126, 127, 128.
- HIL sections with PREPARE / USER / VERIFY: 36, 41, 47, 50, 51, 54, 55, 56, 57 (name), 62-65, 66-69, 71, 125, 126, 127, 128 (search part).
- No secret value: section 1.2 scan run on this file (result in `delegation_progress/row_18_data_analyst.md`).
- Ban self-check: the banned strings of section 1.3 appear only in the ban list, in read-only checks (`du -sb`, `sha256sum -c`, `ls`, `stat`, `dpkg -l`) and in rollback references to IMP.

---
*Generated: 2026-10-22 17:23*
*Last Updated: 2026-10-22 17:23*
