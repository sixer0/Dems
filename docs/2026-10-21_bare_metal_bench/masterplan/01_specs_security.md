---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: security-review
row: 14
type: spec (install security delta, host .73)
narrative_tier: 1
assessment: CAUTION (design is sound; four items are hypotheses until the host rows run them, section 9)
source_structured_task: identification/02_structured.md row 14 (line 182); F8 (line 79); W4, W6 (section 1.7, lines 120, 122); OI-1..OI-4 (section 1.4)
inputs: masterplan/01_specs_register.md (row 12), masterplan/01_specs_service.md (row 15), masterplan/01_specs_rflex_security.md (row 89, present when this file was written), research/01_explore_host_survey.md (row 6), research/01_explore_cli_invocation.md (row 4), 02_host_wifi_outage_20261022.md, 03_deployment_check_20261022.md, decisions.md D5-D13, scripts/host/HOST-PROFILE-UBUNTU-24.04.md, scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md
names: install names ONLY from masterplan/01_specs_register.md; one missing name requested as <REQ:ufw_revert_unit> (delegation_progress/file_requests.md); row 15's <REQ:cli_cache_dir> reused
secret_values_in_this_file: none
last_updated: 2026-10-22
---

# Install security delta for host .73 (row 14)

Paths are relative to `/Users/gsp-budi/Documents/DEMS` unless they start with a folder of this task (`research/`, `masterplan/`, `identification/`, `decisions/`, `0N_*.md`). "register:N" = `masterplan/01_specs_register.md` line N. "HP:N" = `scripts/host/HOST-PROFILE-UBUNTU-24.04.md` line N. "IN §x" = `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md` section x.

## 0. 5W1H

| | |
|---|---|
| What | The security rules the bare-metal install on .73 must follow: every secret's flow (who types it, where it lives, how it stays unprinted), the ufw ruleset in order with an auto-revert, the console exposure, the cache ownership of the nologin accounts, the `npm ci` privilege choice (F8), the security reading of D5-D7, and a secret-scan rule for this task's documents |
| Who | Written by security-review (row 14). Applied by rows 22, 27, 36, 41, 49, 54-56, 62-69, 122 (executors) and checked by rows 46, 72, 75, 76. The user types every password (D3, D6, OI-1) and gives the yes of row 36 |
| When | Spec stage S3 (driver_rules.md "Spec waves"; started early under D13). Before row 17 reconciles and row 18 writes the runbook |
| Where | Host `gsp-dems@192.168.0.73`, Ubuntu 24.04.1, admin path Wi-Fi `wlp3s0` only, camera LAN `enp4s0` (register:154-155; research/01_explore_host_survey.md:136-142) |
| Why | The blueprint left four security choices open (row 14 line 182: HOST-23 scope, W4, W6, F8) and approved secret flows (OI-1..OI-4, D8) that need one written rule each before execution. The host has a single management path, so a firewall mistake is a total loss of access (02_host_wifi_outage_20261022.md, contributing factor 1) |
| How | Each rule traced to code, the host survey, the profile, the installer note or a user decision. What was not run is labelled hypothesis with the row that settles it |
| Alternatives | Per item in sections 2-5 (SSH source restriction, revert mechanism, console unit vs manual, npm root vs unprivileged, CLI npm vs direct tsx) |
| Assumptions | sshd listens on 22 (register G1, hypothesis; row 36 reads `sshd -T` first). ufw package defaults on Ubuntu 24.04 (before.rules accepts established traffic, DHCP replies, ICMP echo, mDNS, UPnP) are hypotheses read from the package convention, printed at row 36 |
| Gaps | Section 9 |

## 1. Secret flows

Rule for every line: the agent never types, prints, logs, copies or stores a secret value; checks use `stat`, `grep -c` and exit codes only. A command line is never a carrier of a secret (argv is visible in `/proc/<pid>/cmdline` and in shell history).

| # | Secret | Who types / creates | Where stored | Never printed: how |
|---|---|---|---|---|
| S1 | **OI-1 operator passwords** (3 operators of `dems_demo`) | **The user types all 3** in the user's own Mac terminal over `ssh -t` (D6, D8 OI-1; deviation from IN §2.2 "each operator at the keyboard of the host" and IN §2.5 "not a remote session", recorded in D6). Command run as `dems-core` (owner of `pg.env`, operator-set-password-command.ts:176-182) in the direct-tsx form of masterplan/01_specs_service.md §7.2, row 55. The installer word `SET` is typed by the user too | In the database `dems_demo` in the command's own stored form (form not read in this row) | Hidden prompt, raw mode, no echo (secret-prompt.ts:265-267). The agent does not hold that terminal: no `script`, `tmux pipe-pane`, terminal recorder or screen share while typing (IN §2.5). `--password` is a usage error (research/01_explore_cli_invocation.md §3). `sudo` resets the environment, so no password-named variable reaches the command (refusal `PASSWORD_VARIABLE_SET`, operator-set-password-command.ts:190, :367). Not written in any document, sheet or backup note (IN §2.8). The agent verifies by the command's summary line and the 3 `OPERATOR_PASSWORD_SET` audit entries only (row 55) |
| S1a | Attended-check value (row 54) | The user, a **throw-away value**, never a real password (IN §2.4) | Nowhere (the check prints outcome only) | As S1 |
| S2 | **OI-2 console sign-in over the SSH forward** | The user, in the Mac browser at `http://127.0.0.1:5173`, through `ssh ... -N -L 5173:127.0.0.1:5173 gsp-dems@192.168.0.73` (register:178) | Typed value = an S1 password; session cookie in the Mac browser | The HTTP leg is plaintext only on two loopbacks (Mac browser to the local ssh client; host sshd to `127.0.0.1:5173` to `127.0.0.1:4420`); the Wi-Fi leg is inside SSH. Hardening, compatible with the Origin guard (config.ts:101-102 needs local port 5173 and host `127.0.0.1`): write the bind address explicitly, `-L 127.0.0.1:5173:127.0.0.1:5173`, so the forward never listens on the Mac's LAN side even if `GatewayPorts` is set in the Mac's ssh config. Forward runs only while the console is used; stop it after (row 49) |
| S2a | SSH private key used for the forward and for the agent | Exists on the Mac (`~/.ssh/id_ed25519_smartwms`, driver_rules.md) | The Mac only | Cited by path only; never copied to the host, to `/docs` or to a prompt |
| S3 | **OI-4 DB role secrets** (runtime role `dems_app`, owner role `dems_owner`; register:265-266) | **Nobody types.** Option B (D8): the agent generates each value on the host, inside one root shell process, and writes it straight into its two targets | (a) `/opt/dems/core/.data/pg.env` key `DEMS_PG_APP_PASSWORD`, and `/opt/dems/core/.data/pg.owner.env` key `DEMS_PG_OWNER_PASSWORD`, both `dems-core:dems-core` 0600 (register:96-97); (b) the PostgreSQL cluster as a SCRAM verifier. Lifetime of `pg.owner.env`: row 13 decides (register G6); the rules below hold either way | Rules for row 13/41 (they write the exact commands): (1) generated on the host, never on the Mac; fixed form 43 characters of `[A-Za-z0-9]` (e.g. `tr -dc 'A-Za-z0-9' </dev/urandom \| head -c 43` into a shell variable), so the scan of section 7 can detect a leak; (2) the script is fed over `ssh ... 'sudo bash -s' < file` from a Mac file that holds no secret; no `set -x`, no `bash -x`; (3) files written by `printf` (a builtin, not in argv) into `install -o dems-core -g dems-core -m 0600 /dev/stdin <path>`; (4) role password set through `sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d postgres` reading SQL from stdin, with `SET log_min_error_statement TO panic;` and `SET log_statement TO none;` first in that session, so a failing `ALTER ROLE ... PASSWORD` is not written to the server log with its text; never `PGPASSWORD=`, never a connection URI with a password, never `psql -c`/`-v` carrying the value; (5) check by `stat -c '%U %G %a'` and `grep -c '^DEMS_PG_APP_PASSWORD=.'` (count only) and a `db:status` exit code |
| S3a | PostgreSQL superuser `postgres` | Nobody: no password is set | Not stored | Used via `sudo -u postgres` and local peer authentication (hypothesis: postgresql-common default `pg_hba.conf`; row 40 prints the non-comment `pg_hba.conf` lines, which hold no secret) |
| S4 | **Camera passwords** (CAM-A..D, 192.168.100.101/.102/.103/.117; register:156) | The user. **Changed on each camera's own web page before adoption** (rows 62-65), through the F7 forward `-L 18101:192.168.100.101:80 ...` (register:179; D8 F7). The same new value is typed again by the user in the console at adoption (rows 66-69) | Camera firmware; inside the Core's own store under `/opt/dems/core/.data` and the database (storage form not read in this row) | The user types both times; the record sheet line holds no password (rows 62-65 criteria). The values used in the Docker session are burned (S7) and must not be re-entered. Digest only, never Basic, is a code property (row 89 RR-1, onvif-session.ts:19-25). Camera forwards bind `127.0.0.1:` explicitly, same reason as S2 |
| S5 | **Production signing key** (key id `CORE-KEY-EVSIGN-01`) | The command `evidence:production-key`, run by **the user** as `dems-core` over `ssh -t` (row 56; root refused, production-key-command.ts:395). The user types the organisation name (OI-3), the device id `DEMS-BENCH-01` (register:276) and the word `PROVISION`. **A new key in the new data dir** | `/opt/dems/core/.data/signer` (key, wrap secret, certificate) and `/opt/dems/core/.data/handover` (register:82) | The command prints only the certificate fingerprint, which is public (IN §2.7); row 61 records it. **Never carry over** `signer/` or `signer.dev-backup/` from the Docker backup: the dev key and the old production key share the id `CORE-KEY-EVSIGN-01` (03_deployment_check_20261022.md D1); `KEY_EXISTS` would refuse a new key on top of a copied store (IN §2.6). Signer directory never in a backup, an image or another machine (IN §2.8); a backup of `.data` excludes `signer/` before row 56 runs (IN §2.8 last line) |
| S6 | Docker-era secrets in the backup `vol-dems_dems-data` (`signer/`, `signer.dev-backup/`, the credential store, `pg.env`; 03_deployment_check_20261022.md "Backups") | Already exist | `~/dems-backup-20261021` on .73 and `.data/bench-backup-20261021` on the Mac (the Mac folder is mode 0700 and git-ignored: `ls -ld`, `git check-ignore` .gitignore:71, read 2026-10-22) | **Not restored, not copied, not extracted** into `/opt/dems/core/.data` (row 26 excludes `.data`, register:278; row 121 excludes `.data`). Kept per D7 only as a bench record. The host folder's mode is not known: row 20 prints `stat -c '%U %a'` of it (read-only) |
| S7 | **Old plaintext passwords** in `docs/2026-10-21_bench_deploy_findings/` | Typed in the Docker session (O2 in decisions.md) | `HANDOFF-DEMS-BENCH.md` sections §2, §3, §7, §9 and `DEMS-TEMUAN-20261021.md` section §C hold password words (keyword grep, line numbers only, values not opened in this row). The folder is git-excluded (.git/info/exclude:54) but mode 0755. **A newer copy of the HANDOFF file is on the host Desktop** (02_host_wifi_outage_20261022.md "Desktop contents") | Cited by section only, never quoted. **Every password in those files is treated as burned and must not be reused**: operator (S1), camera (S4), DB role (S3, regenerated anyway). If one of them is a login password of `gsp-dems`, the user changes it (row 96 item R14-3). Deletion or a mode change of those files is the user's call only (CLAUDE.md §4) |
| S8 | Wi-Fi PSK of profile `GSP 01 5G` | Existing | `/etc/netplan/90-NM-<uuid>.yaml`, 0600 (research/01_explore_host_survey.md §9) | Never opened; ufw work does not need it |
| S9 | `gsp-dems` sudo | n/a | `/etc/sudoers.d/90-gsp-dems`, NOPASSWD (survey §12) | No sudo password is ever typed by the agent |

Non-secrets typed by the user for completeness: the organisation name (OI-3) and the installation display name (register 96-R12-1).

## 2. ufw ruleset for row 36 (exact commands, in order)

### 2.1 Scope of HOST-23

Source: **masterplan/01_specs_rflex_security.md §6 (row 89)**, present when this file was written: "D12 U-RF3, search answers on the camera port only, AC7 unchanged". Consequence stated there: multicast search answers are admitted on `enp4s0` only; on Wi-Fi a camera is found by typed address only (typed-probe reply admitted as ESTABLISHED, hypothesis until 9A/H-12); outgoing ONVIF/RTSP is allowed on every interface. No `<DEP:row89:HOST-23>` placeholder is needed.

### 2.2 Commands

Run from the agent's existing SSH session unless stated. `<REQ:ufw_revert_unit>` is the transient unit name requested from the register (proposal `dems-ufw-revert`).

```
# R0  read-only pre-checks; stop and report if any result differs
sudo -n sshd -T | grep -E '^(port|listenaddress|passwordauthentication|permitrootlogin|allowtcpforwarding|gatewayports) '
                                                  # port 22 expected (register G1); forwarding must stay allowed (OI-2, F7)
sudo -n ufw status verbose                        # "Status: inactive" (survey §8)
sudo -n ufw show added                            # no user rule yet; if any exists: stop, do not reset (user's call)
grep -E '^(IPV6|DEFAULT_FORWARD_POLICY)=' /etc/default/ufw
sudo -n grep -nE 'echo-request|5353|1900' /etc/ufw/before.rules   # record the package's built-in accepts (section 2.4)
ip -br addr show wlp3s0; ip -br addr show enp4s0  # 192.168.0.73/24 and 192.168.100.254/24
systemctl is-active dems-wifi-watchdog.timer      # active; untouched by this row

# R1  SSH on wlp3s0 FIRST (D5, HOST-22 "the user's own remote-administration rule first")
sudo ufw allow in on wlp3s0 to any port 22 proto tcp comment 'DEMS admin SSH on Wi-Fi (D5)'

# R2  defaults (written to config; nothing filters until R6)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw default deny routed

# R3  HOST-23, camera port only (D12 U-RF3; row 89 §6; HP:85)
sudo ufw allow in on enp4s0 proto udp from any port 3702 comment 'DEMS camera search answers'

# R4  review: exactly the R1 and R3 rules (each with its v6 twin if IPV6=yes)
sudo ufw show added

#     HIL: the user's yes for row 36 is recorded here. No yes, no R5.

# R5  arm the auto-revert BEFORE enable (runs under systemd, survives the SSH session dropping)
sudo systemd-run --unit=<REQ:ufw_revert_unit> --description='DEMS ufw auto-revert (row 36)' --on-active=300 /usr/sbin/ufw disable
systemctl list-timers --all --no-pager <REQ:ufw_revert_unit>.timer     # one line, about 5 min left

# R6  enable (--force skips the interactive "may disrupt existing ssh connections" prompt)
sudo ufw --force enable
sudo ufw status verbose     # Status: active; Default: deny (incoming), allow (outgoing), deny (routed)

# R7  from the Mac: a FRESH login on a new TCP connection (no multiplexed master), within the 5 min
ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -o BatchMode=yes -o ControlMaster=no -o ControlPath=none -o ConnectTimeout=15 \
    gsp-dems@192.168.0.73 'sudo -n ufw status verbose; systemctl is-active <REQ:ufw_revert_unit>.timer'

# R8  disarm ONLY after R7 printed "Status: active", in a fresh session of the same form as R7
ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -o BatchMode=yes -o ControlMaster=no -o ControlPath=none -o ConnectTimeout=15 \
    gsp-dems@192.168.0.73 'sudo systemctl stop <REQ:ufw_revert_unit>.timer; systemctl is-active <REQ:ufw_revert_unit>.timer; sudo -n ufw status verbose'
                            # expect "inactive" for the timer, "Status: active" for ufw
```

Failure path: if R7 fails, do not loop. Retry once after 60 s (driver_rules.md addendum). If it still fails, wait until 300 s after R5 have passed: the timer runs `ufw disable`, and the host is back to its survey state (ufw inactive). Log in again, record `Status: inactive` and `journalctl -u <REQ:ufw_revert_unit>.service --no-pager`, report row 36 `blocked`. If SSH fails even after the revert, the cause is not the firewall: treat it as the Wi-Fi fault of 02_host_wifi_outage_20261022.md (the watchdog reloads the driver at 5 and 10 minutes) and report; do not touch NetworkManager (driver_rules.md).

### 2.3 Why this form

| Choice | Chosen | Alternatives and why not |
|---|---|---|
| Revert mechanism | `systemd-run --on-active` transient timer | `at` (not installed: survey §10 lists no `at`); `sleep 300 && ufw disable &` in the SSH shell (dies with the session it is meant to rescue); a cron line (persists if forgotten) |
| Window | 300 s | Long enough for R6-R8 by the agent; shorter than the watchdog's first reboot threshold (15 min, 02_host_wifi_outage_20261022.md F3 rules) |
| SSH rule source | any source on `wlp3s0` | Source-limit to the Mac `192.168.0.14`: the Mac's address comes from DHCP, and a lockout on the only management path costs a power-key reset (02_ file). Offered at row 96 (R14-1) |
| `allow` vs `limit` for SSH | `allow` | `ufw limit` refuses a source after 6 connections in 30 s; the agent opens many short SSH calls and would lock itself out |
| Reboot between R6 and R8 | ufw comes up enabled, revert timer gone (transient) | Accepted: R1 is in place; rows 47 and 71 re-check SSH after their reboots |

### 2.4 Effects to record (not to change in this row)

- The Core (`127.0.0.1:4420`), the console (`127.0.0.1:5173`), PostgreSQL (`127.0.0.1:4432`) and the worker listeners (`127.0.0.1:8554-8564`) stay on loopback (register:189-194); ufw holds no ALLOW for them (HOST-24, HP:86). ufw's loopback accept and the nft table `inet dems_loopback` (file D) are independent hooks; a packet must pass both. Hypothesis that they coexist without effect on each other; row 46 runs the HOST-25 counter check with ufw active.
- The Wi-Fi watchdog `dems-wifi-watchdog.timer` pings the gateway outgoing; replies return as ESTABLISHED. ufw does not affect it. Its reboot step is held off by `/etc/dems-wifi-watchdog.noreboot` (row 123, U-RF7), not by this row.
- Package built-in accepts (hypothesis, printed at R0): ICMP echo request, DHCP client replies, mDNS 5353 and UPnP 1900 multicast are accepted by `/etc/ufw/before.rules` on every interface. None is a DEMS port, so AC7 ("No DEMS port is reachable from Wi-Fi", 01_translated.md:63) holds. Row 72 should not count a ping answer as a breach. Editing `before.rules` is offered at row 96 (R14-2), not done.
- `ufw logging` stays at the package default `low`: blocked inbound attempts reach the kernel log (ISO 27001 A.12.4).

## 3. Console unit exposure (W4)

| Fact | Evidence |
|---|---|
| The console is the Vite 8.3.1 development server, bound to `127.0.0.1:5173`, `strictPort` | apps/core-web/vite.config.ts:86-88; apps/core-web/package.json:56 |
| The brief's premise "accepts any Host header" is **partly** right. Vite 8.3.1 checks the Host header by default (`allowedHosts: []`, node_modules/vite/dist/node/chunks/node.js:24982; check applied when `https` is off, :24877). The check **accepts any IPv4/IPv6 literal and `localhost`/`*.localhost`**, refuses other names (:16832-16846). vite.config.ts sets neither `allowedHosts` nor `https` | read 2026-10-22 in the Mac tree; the host gets the same version from the lock file (package-lock.json:127) at row 27 |
| It has no authentication of its own, serves the source tree (fs `strict: true` keeps it to the workspace, node.js:24993-24994), opens an HMR websocket, and proxies `/api/v1`, `/ws`, `/media`, `/exports` to the Core | vite.config.ts:51-71 |

Ruling: the dev server is not built to face a network. **It stays loopback-only.** Concretely:
1. The unit of masterplan/01_specs_service.md §8.3 starts it without `--host`; no `server.host` override, no `allowedHosts: true`, no `Environment=` that changes the host.
2. ufw holds no ALLOW for 5173 (row 36 R4 shows two rules only).
3. Reached only through the S2 forward, bound `127.0.0.1:` on the Mac.
4. Runs as the separate account `dems-console` (service spec §3; register:69), which cannot read `/opt/dems/core/.data` (0700, register:80). Agreed: the account split matters more than the Host check, because any local process on .73 can reach `127.0.0.1:5173` (local accounts today: `gsp-dems` plus system accounts, survey §6).
5. Enabled at boot (service spec F-S4 option a) is acceptable on this exposure: it adds no network reach. If the user prefers "on demand", keep the unit disabled and start it per use.
6. Row 122 check: `sudo ss -H -ltnp 'sport = :5173'` shows `127.0.0.1:5173` only; any `0.0.0.0`, `[::]` or LAN address is a stop.

Residual (low): a DNS-rebinding page in the Mac browser cannot use a hostname (refused by the Host check), and an IP-literal page origin is not the Core's accepted Origin `http://127.0.0.1:5173` (config.ts:101-102), so API calls through the proxy are refused by the Core.

## 4. Cache ownership for the nologin accounts (W6, F-S1)

| Process | Writes outside its data | Owner and mode | Evidence |
|---|---|---|---|
| Core (`dems-core.service`) | `/tmp/tsx-<uid>` (tsx cache and IPC pipe) | `dems-core`, created under the unit's `UMask=0077` | masterplan/01_specs_service.md §4.6 (tsx dist read; not run) |
| CLI runs as `dems-core` (rows 54-56), direct-tsx form (service spec §7.2) | the same `/tmp/tsx-<uid>`, `.data/`, `apps/core-server/logs/` | `dems-core` | service spec §7.1-7.2 |
| Console (`dems-console`) | `apps/core-web/node_modules/.vite` | `dems-console` 0700 | register:84; service spec §2 |

Rulings:
- **F-S1: support option (a), home `/nonexistent`** for both accounts. With the data dir fixed inside the evidence store (W1), a home there would let npm or any tool write caches next to the signer and media. The Core reads no `HOME` (service spec §3, grep). Security concurs with row 15.
- **CLI form: direct tsx (service spec §7.2, F-S3 a).** It needs no npm cache, no `HOME` and passes no npm-injected variable names to the password command (U3, U4 of service spec §7.4 drop out). `<REQ:cli_cache_dir>` is then not created.
- If the user picks the npm form (F-S3 b): `<REQ:cli_cache_dir>` made by root with `install -d -o dems-core -g dems-core -m 0700`, **outside** `/opt/dems/core/.data` (proposal `/var/cache/dems-cli`, row 15's request), passed as `npm_config_cache`; `HOME=/nonexistent`.
- `/tmp/tsx-<uid>` is a predictable name in a shared `/tmp`; another local account could pre-create it. Low on .73 (one login account with sudo). `PrivateTmp=yes` would close it but is extra hardening the profile excludes (HP:236; service spec §4.1). Recorded, not adopted; row 58 lists `stat -c '%U %a' /tmp/tsx-*` and expects owner `dems-core`.

## 5. F8: `npm ci` privilege (row 27)

Finding F8 (02_structured.md:79): `npm ci` in a root-owned tree runs lifecycle scripts as root.

Facts: the root `package.json:24` has `postinstall: sh apps/mobile/scripts/apply-patches.sh` (patches the mobile app, not deployed). Packages with install scripts in `package-lock.json`: `esbuild` (three copies), `unrs-resolver`, `vue-demi` (three), `@shopify/react-native-skia`, `fsevents` (macOS, optional), `@embedded-postgres/*` (optional, dev) (lock file scan, `hasInstallScript`). The Docker image that ran on .73 installed with `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/npm-cache -w @dems/shared -w @dems/capture-protocol -w @dems/transcriber -w @dems/core-server -w @dems/core-web`, stating that no package of these five workspaces needs an install script (esbuild ships its binary as a platform package) (deploy/docker/Dockerfile:177-180), then verified `tsx --version` and `vite.js` (:184-185).

| Option | Scripts run as | Verdict |
|---|---|---|
| A. root, `--ignore-scripts`, five workspaces, throw-away cache | none | **Chosen.** No third-party code runs at install time; same form as the image that ran on .73 |
| B. root, scripts on | root | Rejected: F8 itself; also runs the mobile `postinstall` |
| C. build as `gsp-dems` in staging, copy as root | `gsp-dems` | Rejected: `gsp-dems` has NOPASSWD sudo (survey §12), so it is not a lower privilege |
| D. build as a new throw-away account | that account | Rejected: a new name and account for no gain over A |

Row 27 form (root, in `/opt/dems/core`, Node from the register path):

```
cd /opt/dems/core
NPMCACHE=$(sudo mktemp -d /root/npm-cache.XXXXXX)
sudo env PATH=/opt/dems/node-26.12.1/bin:/usr/bin:/bin npm ci --ignore-scripts --no-audit --no-fund --cache "$NPMCACHE" \
  -w @dems/shared -w @dems/capture-protocol -w @dems/transcriber -w @dems/core-server -w @dems/core-web
sudo rm -rf "$NPMCACHE"
```

Checks: exit 0; `node_modules/tsx/dist/cli.mjs` and `node_modules/vite/bin/vite.js` exist; `sudo find /opt/dems/core/node_modules -perm /022 -print -quit` prints nothing; owner root. Integrity comes from the lock file's `integrity` hashes, which `npm ci` enforces. If a needed binary is missing (hypothesis: none, per the Docker precedent), stop and report; do not switch to option B without a recorded decision.

## 6. D5, D6, D7: security reading

| Id | Decision | Security statement | Residual and owner |
|---|---|---|---|
| D5 | Wi-Fi stays up through PREP-08..9A/H-16; ufw admits SSH only | The only inbound service on Wi-Fi is sshd (R1); every DEMS listener is loopback (section 2.4). The management path and the room network are the same link, so the firewall's correctness is protected by the auto-revert (section 2) | sshd's own settings (password login, root login) are read at R0, not changed; a change is a row-96 item (R14-4). Recorded bench deviation from HW-ACCEPTANCE PREP-08/PREP-11 |
| D6 | Operator passwords typed over SSH (`ssh -t`), not at the host keyboard; the agent never types one | The secret crosses Wi-Fi inside SSH only and is never echoed (S1). The risk IN §2.5 guards against moves to the user's Mac: no terminal recorder, no screen share, no session log of that terminal | Accepted by D6. The audit entry does not record who typed (IN §2.2): the bench record says "typed by: the user" |
| D7 | Signer private keys kept in both pre-task backup copies | Deviation from IN §2.8. The bench key never sealed (03_deployment_check_20261022.md D1: no media in the volume). It must not become active again: never restored into the new data dir (S5, S6), never used to seal | A leaked copy would be able to sign as `CORE-KEY-EVSIGN-01` with the OLD certificate; the new key has a new fingerprint (row 61), so receivers trust only the new fingerprint. Deleting the copies stays the user's call |

## 7. Secret-scan rule for every artifact of this task

Scope: every file under `docs/2026-10-21_bare_metal_bench/` that a row creates or changes, plus any host-side record the row writes (for example the row-20 baseline folder listing). When: each row before it reports `complete` (its own files), and row 75 over the whole folder.

Command (prints file names only, never a matching line):

```
cd /Users/gsp-budi/Documents/DEMS/docs/2026-10-21_bare_metal_bench
grep -rIlE \
  -e '-----BEGIN [A-Z ]*PRIVATE KEY-----' \
  -e '(PASSWORD|PASSWD|SECRET|TOKEN|PSK)[A-Z_]*[[:space:]]*[=:][[:space:]]*[^[:space:]<`|"'"'"']' \
  -e '[a-z][a-z0-9+.-]*://[^/[:space:]:@]+:[^/[:space:]@]+@' \
  -e '(^|[^A-Za-z0-9])[A-Za-z0-9]{43}([^A-Za-z0-9]|$)' \
  -e '(^|[[:space:]])psk[[:space:]]*[=:]' .
```

Patterns: private key blocks; a secret-named key followed by a literal value; a URL with user and password (postgres, rtsp, http); a run of exactly 43 alphanumerics (the S3 form; sha256 hex is 64, git hashes 40); a PSK line. Pass = no file listed. A listed file is inspected with the value masked (`grep -nE '<pattern>' <file> | sed -E 's/([=:@])[^[:space:]]+/\1<masked>/g'`) and either fixed or recorded as a false positive by `file:line` in the row's `delegation_progress/` file. The rule cannot detect a reused old password (S7) or a camera password of free form; for those the procedural rules of section 1 are the control, and the user confirms at rows 55 and 62-65 that no value from the findings folder was reused (the agent sees neither).

Self-check of this file: the command above was run on `masterplan/01_specs_security.md` when it was written; result in `delegation_progress/row_14_security_review.md`.

## 8. Control mapping (brief)

| Control | Where met in this spec |
|---|---|
| ISO 27001 A.9 access control | Separate nologin accounts `dems-core`, `dems-console` (section 3, 4); passwords typed by the user only (S1, S4) |
| A.10 cryptography | SSH for every Wi-Fi leg (S2); SCRAM role secrets (S3); new signing key, old keys never reused (S5, D7) |
| A.12.4 logging | ufw logging low; operator and key commands write audit entries (S1, S5) |
| A.12.6 / A.14.2 supply chain | `npm ci` from lock-file hashes with no install scripts (section 5) |
| A.13 communications | Default deny incoming and routed; SSH only on Wi-Fi; HOST-23 on the camera port only (section 2) |
| GDPR | Not opened by this row: recordings and operator records are personal data, handled by the product and the user's site rules, outside the install delta |

## 9. Gaps, hypotheses, owners

| # | Item | Status | Settled at |
|---|---|---|---|
| H1 | sshd port 22 and forwarding allowed | hypothesis (register G1) | row 36 R0 |
| H2 | ufw `before.rules` built-in accepts (ICMP echo, DHCP, mDNS, UPnP) | package convention, not read on .73 | row 36 R0 |
| H3 | Typed-probe reply on Wi-Fi admitted as ESTABLISHED | hypothesis (row 89 §6) | 9A/H-12, rows 66-69 |
| H4 | ufw and the nft loopback table do not interfere | hypothesis | row 46 (HOST-25 counter with ufw active) |
| H5 | `--ignore-scripts` leaves no needed binary missing on Linux | Docker precedent, not run on bare metal | row 27 checks |
| H6 | `/tmp/tsx-<uid>` owner and mode | read in tsx source only | row 58 |
| H7 | `pg_hba.conf` local peer for `postgres` | package convention | row 40 |
| G1 | Contents of the bench findings folder by secret type | not opened (section-level only) | the user (R14-3) |

## Placeholders for row 95

| Placeholder | Default used | Resolve against |
|---|---|---|
| `<REQ:ufw_revert_unit>` | `dems-ufw-revert` (transient unit, exists only between R5 and R8) | masterplan/01_specs_register.md (request filed in delegation_progress/file_requests.md) |
| `<REQ:cli_cache_dir>` | only if the npm CLI form is chosen; `/var/cache/dems-cli` | register (row 15's request) |
| (none of the `<DEP:...>` kind) | HOST-23 scope taken from masterplan/01_specs_rflex_security.md §6 (row 89 landed before this file) | - |

## For row 96

| Id | Question | Options | Recommendation |
|---|---|---|---|
| R14-1 | SSH rule source on Wi-Fi | (a) any source on `wlp3s0`; (b) only the Mac `192.168.0.14` | (a): DHCP address of the Mac; lockout on the only management path |
| R14-2 | ufw built-in accepts on Wi-Fi (ICMP echo, mDNS, UPnP) | (a) keep the package defaults, record them; (b) edit `/etc/ufw/before.rules` to drop them on `wlp3s0` | (a): no DEMS port involved; editing package rules adds upgrade drift |
| R14-3 | Plaintext passwords in `docs/2026-10-21_bench_deploy_findings/` and the host Desktop copy of the HANDOFF file | (a) leave as is, all burned; (b) the user deletes or restricts them (mode 0600); (c) (b) plus a new `gsp-dems` login password if one is in them | (b), plus (c) if applicable. Deletion only on the user's word |
| R14-4 | sshd settings found at R0 (e.g. password login on) | (a) record only; (b) key-only login as a separate host change | (a) in this task; (b) as a follow-up with its own revert |
| R14-5 | Console start | (a) unit enabled; (b) unit on demand | (a): loopback only, separate account (section 3) |

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22*
