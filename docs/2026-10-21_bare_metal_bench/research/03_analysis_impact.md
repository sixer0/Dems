---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 16
type: mixed (impact assessment: blast radius, stop rules, rollback)
tier: 1
confidence: MEDIUM (host facts and specs read; no command in this file has run on .73; every unrun command is a proposal for the runbook, row 18)
source_structured_task: identification/02_structured.md (row 16, line 184; W1 line 117, W12 line 128; Risk Assessment lines 481-497)
source_translated_task: identification/01_translated.md
inputs: masterplan/01_specs_register.md (row 12), masterplan/01_specs_service.md (row 15), masterplan/01_specs_rflex_security.md (row 89, landed 16:51), research/01_explore_host_survey.md (row 6), 01_backup_and_docker_removal.md, 02_host_wifi_outage_20261022.md, 03_deployment_check_20261022.md, decisions.md D7-D13, scripts/host/HOST-PROFILE-UBUNTU-24.04.md §3.4, §3.10, §6, scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md, implementation/48_rflex_restore_point.md
dependencies: row 11 (research/03_analysis_applicability.md) ABSENT at 16:51 -> `<DEP:row11:...>`; row 89 PRESENT -> used
last_updated: 2026-10-22 16:55
---

# Install impact assessment for host .73 (row 16)

## Source tasks
- Structured: identification/02_structured.md (row 16)
- Translated: identification/01_translated.md
- Original: identification/01_original.md

## Exploration and collection summary
- Host: research/01_explore_host_survey.md; 02_host_wifi_outage_20261022.md; 03_deployment_check_20261022.md; 01_backup_and_docker_removal.md
- Specs: masterplan/01_specs_register.md (all install names), masterplan/01_specs_service.md, masterplan/01_specs_rflex_security.md
- No external research dimension is in scope for this row (no technology, vendor, market or regulatory question). External Research Synthesis: no findings, by scope.

## Names and placeholders used

Install names are taken verbatim from masterplan/01_specs_register.md (cited as `register:<line>`). R-FLEX guard ids (RG-n, RR-n, NW-R1) are from masterplan/01_specs_rflex_security.md (row 89) and masterplan/01_specs_rflex_register.md. Four names this file needs are not in the register; they are written as `<REQ:...>` and requested in delegation_progress/file_requests.md:

| Placeholder | What it names | Proposal (for the register) |
|---|---|---|
| `<REQ:host_baseline_dir>` | the mode-700 folder of row 20 (pre-change host baseline) | `/home/gsp-dems/dems-host-baseline-<YYYYMMDD>`, gsp-dems 0700 |
| `<REQ:install_backup_dir>` | the folder for backups taken after DEMS data exists (`.data` without signer, DB dump) | `/home/gsp-dems/dems-install-backup-<YYYYMMDD-HHMM>`, gsp-dems 0700 |
| `<REQ:ufw_revert_unit>` | the transient systemd unit that disables ufw if the new SSH session fails (row 36) | `dems-ufw-revert` |
| `<REQ:disk_free_threshold>` | the free-space floor of the stop rule in R6 and the row-73 check | 20 % of `/` |

## 0. 5W1H frame

| | |
|---|---|
| What | The blast radius of the bare-metal install (rows 20-79, 121-128) on host .73, one stop rule and one rollback command block per risk, per-stage rollback, and the rollback of the whole install to the pre-install state, including the optional return of the Docker stack |
| Who | Written by data-analyst (row 16). Consumed by row 17 (consolidated spec), row 18 (runbook: stop conditions and rollback blocks), row 77 (rollback readiness), row 78 (deviation register), the controller at each HIL row (36, 41, 47, 54-58, 62-71, 124-127). Commands run by coder-execution / database-specialist on the controller's delegation; the user decides every item marked "user's word" |
| When | Before the install starts (row 20 is held behind gate G-RF, 02_structured.md:188). The stop rules apply from row 20 to row 128; rollback blocks apply at any point after their stage |
| Where | Host gsp-dems@192.168.0.73 (`gsp-dems-A520I-AC`, Ubuntu 24.04.1, one ext4 file system, Wi-Fi the only admin path: research/01_explore_host_survey.md:17-19, :146). The Mac (192.168.0.14) is touched only by the SSH forward (OI-2) and by reading; PC 192.168.0.72 is out of scope (driver_rules.md:7) |
| Why | The install changes a host whose only management path has already failed once for 18 h (02_host_wifi_outage_20261022.md:6-30), which holds the only backups of the Docker era (01_backup_and_docker_removal.md:6-14), and which will hold evidence once REAL_PRODUCTION runs (INSTALLER-NOTE:146-152). R-FLEX (D10/D11) widens the Core's network reach to the office LAN |
| How | Each risk was traced to its evidence (file:line), then given (a) a mitigation that removes or reduces the trigger, (b) a stop rule that a driver can test mechanically before or during the row, (c) rollback commands. Commands are derived from the register, the service spec and the host profile; none was run (repo and host read-only for this row). Hypotheses are labelled |

## 1. Overview

The install touches only host .73 and is reversible stage by stage, with three exceptions that need the user's word: the evidence-bearing data (`/opt/dems/core/.data` and the PostgreSQL cluster), the camera passwords the user changes in rows 62-65, and the Docker leftovers, which this install never touches (D7). The two highest risks are SSH lock-out at ufw enable and a Wi-Fi card wedge. Both cut the only admin path, and both have a mechanical stop rule and a timed or physical way back. With the no-reboot flag set (W12, U-RF7), a Wi-Fi wedge during a recording no longer cuts the recording. It does cut every way to control that recording, because the console is reached only through the SSH forward over Wi-Fi (Finding 3). Under R-FLEX the Core may dial devices on the attached office LAN (D11). On the host side, the residual guards are HOST-20, HOST-22, HOST-24 and HOST-25 plus RG-12 in code.

## 2. Requirements (of this row)

- Functional: every risk named in the brief has a mitigation, a stop rule and rollback commands (section 5, R1-R12).
- Functional: W12 (watchdog reboot during a recording, flag `/etc/dems-wifi-watchdog.noreboot`, U-RF7) and D11 (R-FLEX posture on the office LAN) are present (R3, R12).
- Functional: per-stage rollback and the whole-install rollback to the pre-install state (HOST-PROFILE §6 plus PostgreSQL), and the Docker-stack restore from `~/dems-backup-20261021` on the user's word (sections 6, 7).
- Non-functional: names only from the register; no secret value; repo and host read-only; placeholders listed for row 95.

## 3. Key findings

### Finding 1: Nothing in the install needs to touch the Docker-era data, and three common commands would [Confidence: HIGH]
- Description: `/var/lib/docker` (70 MB, volumes `dems_dems-{data,logs,pgdata}`), `/var/lib/containerd` (2.3 GB, images), `~/dems-backup-20261021/` and `~/dems-change-backup-20261021.sql` are kept by the user's rule (01_backup_and_docker_removal.md:20-21; 03_deployment_check_20261022.md:9; D7 keeps the signer keys in both backup copies). `containerd.io` and `docker-ce` are in dpkg state `rc` (03_deployment_check_20261022.md:11). Three command forms could reach them: `apt-get purge` / `dpkg -P` of those `rc` packages (hypothesis: their purge scripts may delete the state directories; not read), `apt-get autoremove` (removes git/pigz too, 01_backup_and_docker_removal.md:19), and a `chown -R`/`rm -rf` with a path typo under `/var/lib` or `~`.
- Evidence: as cited.
- Implication: R7 below forbids these command forms for the whole install. The install has no step that needs `/var/lib/docker`, `/var/lib/containerd` or the backup folder, so a path match on any of them is a stop.

### Finding 2: The data dir lives inside the install tree (W1). Any re-copy or "clean reinstall" of the tree therefore puts the evidence store at risk [Confidence: HIGH]
- Description: the data dir is fixed at `/opt/dems/core/.data` (register:42, :80; load-config.ts:53-60). The install dir is root-owned 0755 and `.data` is `dems-core:dems-core` 0700 (register:79-80). A tree copy with delete semantics, a `chown -R root:root /opt/dems/core`, or an `rm -rf /opt/dems/core` destroys or re-owns the signer, `pg.env`, `pg.owner.env` and media (register:83, :93-94). INSTALLER-NOTE:146 forbids copying `signer/` into any backup, and INSTALLER-NOTE:152 says the exclusion must exist before the first key.
- Evidence: register:79-84, :93-94, :207 (A2); masterplan/01_specs_service.md §2 "Ordering note for row 26" and "Backup scope (for row 16)"; INSTALLER-NOTE:146-152.
- Implication: R8 sets the backup scope (`.data` minus `signer/`, plus the DB dump) and the copy form for rows 26 and 121. The whole-install rollback (section 7) keeps `.data` and the PostgreSQL cluster unless the user gives a separate word.

### Finding 3: On this bench, a Wi-Fi loss also removes operator control of a running recording [Confidence: MEDIUM]
- Description: the console listens on 127.0.0.1:5173 and is reached only through the SSH forward from the Mac over Wi-Fi (register:189, :202 OI-2). The Core listens on 127.0.0.1:4420 (register:188). HOST-PROFILE §5 leaves open how a tablet or phone reaches a loopback Core (HOST-PROFILE:290). So when Wi-Fi is down, nobody can stop a session from the console. With the no-reboot flag set, the recording runs on, and so does its signing clock, which is no longer NTP-disciplined (R5). Without the flag, the watchdog reboots after 15 minutes and cuts the recording (02_host_wifi_outage_20261022.md:62).
- Evidence: as cited. Hypothesis: no other operator path exists on the bench (the tablet or phone path is not part of this blueprint's rows).
- Implication: the flag (U-RF7) is the right default because it protects the evidence already being written. But on this bench a recording must be attended (R3 stop rule), and a wedge is recovered by the user's power-key tap, which logind turns into a clean poweroff (HandlePowerKey=poweroff, research/01_explore_host_survey.md:42-45).

### Finding 4: With the camera LAN down, R-FLEX would send camera traffic to the office router unless RG-12 holds [Confidence: MEDIUM]
- Description: when enp4s0 loses carrier (it did on 10-21 19:21, 02_host_wifi_outage_20261022.md:12), the connected route 192.168.100.0/24 goes away (hypothesis: NetworkManager drops the address on carrier loss after its carrier-wait time; not measured). A connection to 192.168.100.x would then follow the default route through wlp3s0 to 192.168.0.1 (route table: research/01_explore_host_survey.md:142), with the stored camera credential in a digest. Before R-FLEX, point 2 refused this (`NO_CAMERA_SOURCE`). Under R-FLEX the guard is RG-12, "on-link only" (NW-R1 `NO_SOURCE_INTERFACE`), which is proposed and recommended but not yet confirmed by the user (Q89-2, masterplan/01_specs_rflex_security.md:136, :233).
- Evidence: as cited.
- Implication: R4 makes "RG-12 confirmed at row 96/119" a precondition of the camera rows. If the user drops RG-12, R4's stop rule becomes the only guard: camera rows stop on any enp4s0 link-down.

### Finding 5: HOST-PROFILE §6 does not fit .73 as written [Confidence: HIGH]
- Description: §6 says "unmask the four targets of HOST-29" and "run `sudo netplan apply`" (HOST-PROFILE:295-297). On .73 the four sleep targets were already masked before the install (dated Oct 20, research/01_explore_host_survey.md:49-52), so unmasking them would leave a state that never existed. File B is not written on .73 (register:100), so `netplan apply` has nothing to undo, and it would re-apply the Wi-Fi profile over the only SSH path. §6 also does not cover PostgreSQL, Node, FFmpeg, the console unit, the PGDG source, ufw itself, or `systemd-time-wait-sync`.
- Evidence: as cited. `<DEP:row11:HOST-29_applicability>`: default "already satisfied before install, no change, no rollback".
- Implication: section 7 gives a .73-specific rollback that restores the baseline of row 20, not the profile's generic text. This is a deviation for row 78.

### Finding 6: The SIGTERM race is a stop-path risk, and every reboot exercises the stop path [Confidence: MEDIUM]
- Description: the recommended ExecStart runs a tsx parent and the Core as its child. Under the default KillMode, both processes get SIGTERM, and the Core can answer the second signal with `process.exit(1)`, skipping `app.capture.shutdown()` (masterplan/01_specs_service.md §4.3; src/index.ts:74-77). `KillMode=mixed` is the mitigation, a hypothesis until row 58. Rows 47 and 71, a power-key poweroff, and every `systemctl stop` all go through this path.
- Implication: R10 puts the stop test (row 58) before any recording row (125-127) and any reboot with the Core enabled (row 71).

## 4. Blast radius

### 4.1 What the install changes (by stage, all on .73)

| Stage | Rows | Changes (register names) | Reversible by | Kind |
|---|---|---|---|---|
| S0 baseline | 20 | creates `<REQ:host_baseline_dir>` (copies of every `/etc` file listed in 4.3, package and unit lists) | delete folder (user's word only: it is the rollback source) | additive |
| S1 accounts, dirs | 21-23 | users `dems-core`, `dems-console`; groups `dems-core`, `dems-netalias`, `dems-console`; `dems-core` into `audio` (row 37); dirs `/opt`, `/opt/dems`, `/opt/dems/core`, `/opt/dems/core/.data` (+ `media/sessions`), `apps/core-server/logs` (register:63-70, :78-86; service spec §3) | `gpasswd -d`, `userdel`, `groupdel`, `rmdir` (R-A in section 7) | additive; `/etc/passwd`, `/etc/group`, `/etc/shadow`, `/etc/gshadow` modified |
| S2 packages, Node | 24-25 | apt package set (HOST-10, HOST-18, build tools); `/opt/dems/node-26.12.1` | `apt-get remove` of the baseline diff; `rm -rf` of the Node dir | additive |
| S3 tree | 121, 26, 27 | staging copy under `/home/gsp-dems/` (row 121); `/opt/dems/core` tree, root-owned; `node_modules` | delete the tree except `.data` (section 7) | additive; `.data` must survive (R8) |
| S4 FFmpeg, programs | 28-31 | `/opt/dems/ffmpeg-9.0.2`; File A `/etc/ld.so.conf.d/dems-ffmpeg.conf`; `apps/capture-worker/build/*` | remove file A, `ldconfig`, `rm -rf` prefix | additive |
| S5 kernel/network | 33-35 | File C `/etc/sysctl.d/60-dems-host.conf` (forwarding 0, core pattern, apport off); File D `/etc/dems/loopback-ingest.nft`; File E `dems-loopback-rule.service` (nft table `inet dems_loopback`) | remove files, `sysctl --system`, `nft delete table`; apport back on (baseline) | modifies kernel runtime |
| S6 firewall | 36 | ufw enabled; `/etc/ufw/ufw.conf` ENABLED, `/etc/ufw/user.rules`, `user6.rules`, `/etc/default/ufw` (routed policy) | `ufw --force reset` (keeps timestamped copies) | **can cut the admin path** (R1) |
| S7 audio, time | 37-38 | `dems-core` in `audio`; `systemd-time-wait-sync.service` enabled (disabled today, research/01_explore_host_survey.md:89) | `gpasswd -d`, `systemctl disable` | modifies boot ordering (R5) |
| S8 PostgreSQL | 39-41, 44 | `/etc/apt/sources.list.d/pgdg.sources`, key `/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc`, `postgresql-18`, `postgresql-client-18` (+ deps), cluster `/var/lib/postgresql/18/main` and `/etc/postgresql/18/main` (hypothesis paths, register:229, :113), port 4432 on 127.0.0.1, roles `dems_owner`, `dems_app`, DB `dems_demo`, `/opt/dems/core/.data/pg.env`, `pg.owner.env` | section 5 R11 | additive; **cluster holds the audit chain** (HOST-52) |
| S9 env, units | 42, 43, 122, 123 | `/etc/dems/core.env` (root:dems-core 0640); `dems-core.service`, `dems-console.service`; `/etc/dems-wifi-watchdog.noreboot` | remove files, `daemon-reload` | additive |
| S10 boots, keys | 47, 48, 52-58 | reboot; SIMULATED and REAL_PRODUCTION boots; operator passwords (user, `ssh -t`); production key in `.data/signer` and `.data/handover` (user) | key: never deleted to "start clean" (INSTALLER-NOTE:129); passwords: user re-runs `operator:set-password` | **creates evidence-relevant state** |
| S11 cameras | 62-69, 124 | camera passwords and clocks (user, via forward); camera rows in `dems_demo`; capture network config | DB: by console; camera passwords: **user only** (not reversible by the agent) | touches 4 external devices |
| S12 R-FLEX audio | 125-128 | mic bindings in `dems_demo`; USB port move (user) | by console (re-bind / release) | DB only |
| S13 final reboot | 71 | reboot | - | stop path (R10) |

### 4.2 Out of the blast radius (must be unchanged at the end; checked by R7)

| Item | Evidence | Check |
|---|---|---|
| `/var/lib/docker`, `/var/lib/containerd` | 03_deployment_check_20261022.md:9 | `sudo du -sb` and `sudo find ... -newer <baseline marker> | head` equal 0 lines |
| `~/dems-backup-20261021/`, `~/dems-change-backup-20261021.sql`, Mac `.data/bench-backup-20261021/` | 01_backup_and_docker_removal.md:6 | `sha256sum -c SHA256SUMS` 0 failures (host), `shasum -a 256 -c` (Mac) |
| `~/DEMS-Linux-Docker-LCD-20261019-amd64-unverified/` | 03_deployment_check_20261022.md:7 | `ls -la` and `sha256sum .env .installed` equal baseline (values never printed) |
| `~/Desktop/DEMS-source` | 02_structured.md:289 (row 121) | row 121 acceptance |
| Wi-Fi fix files F1-F3 (`zz-dems-wifi-powersave-off.conf`, `rtw88-dems.conf`, watchdog program and units) | 02_host_wifi_outage_20261022.md:58-60 | sha256 equal baseline; timer `active` |
| NM profiles `GSP 01 5G`, `DEMS Camera LAN`; netplan files | research/01_explore_host_survey.md:133-144 | `nmcli -t -f NAME,UUID connection show` equal baseline; profile files sha256 equal (contents never printed) |
| `/etc/sudoers.d/90-gsp-dems` | research/01_explore_host_survey.md:175 | sha256 equal |
| `docker.sources`, `/etc/apt/keyrings/docker.asc` | research/01_explore_host_survey.md:110-115 | present (needed for a Docker restore, section 7.3) |
| Office LAN devices (Wi-Fi side) | D11 | R12: only typed-address probes by the user; no adoption of a non-camera device |
| PC 192.168.0.72 | driver_rules.md:7 | never addressed |

### 4.3 Files row 20 must copy (rollback sources)

Pre-existing files the install modifies: `/etc/passwd`, `/etc/group`, `/etc/shadow`, `/etc/gshadow`, `/etc/ufw/ufw.conf`, `/etc/ufw/user.rules`, `/etc/ufw/user6.rules`, `/etc/default/ufw`, `/etc/apport/` settings file `<DEP:row11:HOST-37_apport_file>` (default: `/etc/default/apport`; hypothesis). Plus these state lists:

```
B=<REQ:host_baseline_dir>
sudo install -d -m 0700 -o gsp-dems -g gsp-dems "$B"
sudo cp -a /etc/passwd /etc/group /etc/shadow /etc/gshadow /etc/default/ufw /etc/default/apport "$B"/ 2>/dev/null
sudo cp -a /etc/ufw "$B"/ufw
dpkg-query -W -f='${binary:Package}\t${Version}\t${db:Status-Abbrev}\n' | sort > "$B"/dpkg.txt
apt-mark showmanual | sort > "$B"/apt_manual.txt
systemctl list-unit-files --state=enabled --no-legend | sort > "$B"/units_enabled.txt
sudo ufw status verbose > "$B"/ufw_status.txt
sysctl net.ipv4.ip_forward net.ipv6.conf.all.forwarding kernel.core_pattern > "$B"/sysctl.txt
ls -la /etc/apt/sources.list.d /etc/systemd/system > "$B"/etc_lists.txt
sudo du -sb /var/lib/docker /var/lib/containerd > "$B"/docker_kept_du.txt
(cd ~/dems-backup-20261021 && sha256sum -c SHA256SUMS) > "$B"/backup_check.txt
sudo touch "$B"/marker && sudo find /etc -type f -newer "$B"/marker | wc -l   # 0 right after
sudo find "$B" -type f -exec sha256sum {} + > "$B"/SHA256SUMS.baseline
```
`/etc/shadow` and `/etc/gshadow` copies are secret-bearing: the folder stays 0700 and is never copied off-host.

## 5. Risks: mitigation, stop rule, rollback commands

Convention: `SSH` = `ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -o BatchMode=yes gsp-dems@192.168.0.73` (driver_rules.md:5). "Stop" means: end the row, write the state into the row's artifact, report `blocked` to the controller. Never retry in a loop. A dropped SSH call is retried once after 60 s, then reported (driver_rules.md:14).

### R1. SSH lock-out at ufw enable (row 36). Likelihood medium, impact critical

- Trigger: ufw default-deny is enabled without an SSH allow that matches the real sshd port and interface. Or the auto-revert is not armed. Or the host reboots before the revert fires, because the transient unit does not survive a reboot while `ENABLED=yes` does. Wi-Fi is the only admin path (02_host_wifi_outage_20261022.md:34).
- Mitigation: read the sshd port first: register G1 says port 22 is a hypothesis (register:200, :254). Add the SSH rule before enabling, as D5 and HOST-22 require. Arm a timed revert before `enable`. Confirm with a new SSH session, since an established session survives the enable and proves nothing. Check that the watchdog's last run was clean, so no Wi-Fi fault is in progress. Run row 36 at least 1 h after a boot only if the flag is absent. With the flag present (row 123 done early, see 8.2), a reboot cannot come from the watchdog at all.
- Stop rule (before `enable`): stop if any of these holds:
  1. `sudo sshd -T | awk '$1=="port"{print $2}'` prints anything but the port in the allow rule.
  2. `sudo ufw show added` does not list the SSH allow on `wlp3s0`.
  3. `systemctl list-timers <REQ:ufw_revert_unit>.timer --no-legend | wc -l` is not `1`.
  4. `journalctl -t dems-wifi-watchdog --since -15min | grep -ci reload` is not `0`.
  5. The user's yes is not recorded.

  After `enable`, stop and wait for the revert if the new session fails twice, 60 s apart.
- Commands (apply, for row 18):
```
sudo sshd -T | awk '$1=="port"{print $2}'                 # expect 22 (G1)
sudo ufw default deny incoming && sudo ufw default deny routed
sudo ufw allow in on wlp3s0 to any port 22 proto tcp comment 'admin SSH (D5)'
sudo ufw allow in on enp4s0 proto udp from any port 3702 comment 'DEMS camera search answers'   # HOST-23, U-RF3
sudo systemd-run --unit=<REQ:ufw_revert_unit> --on-active=300 /usr/sbin/ufw --force disable
sudo ufw --force enable
# from the Mac, a NEW session:
$SSH 'sudo ufw status verbose'                             # must succeed
sudo systemctl stop <REQ:ufw_revert_unit>.timer            # only after the new session succeeded
```
- Rollback commands:
```
# automatic: the timer fires after 300 s and runs `ufw --force disable`
# manual, from any working session:
sudo ufw --force disable
# back to the exact pre-install state (inactive, no rules; ufw keeps *.rules.<timestamp> copies):
sudo ufw --force reset
sudo cp -a <REQ:host_baseline_dir>/ufw/ufw.conf /etc/ufw/ufw.conf && sudo cp -a <REQ:host_baseline_dir>/default/ufw /etc/default/ufw
grep ^ENABLED /etc/ufw/ufw.conf                            # ENABLED=no
# if locked out AND rebooted (revert lost): the user at the host keyboard: sudo ufw disable
```

### R2. Wi-Fi card wedge (rtw88_8821ce DMA fault). Likelihood low to medium, impact critical (admin path lost)

- Trigger: the 10-21 fault (AMD-Vi IO_PAGE_FAULT, then `failed to get tx report from firmware`), which the driver did not recover from in 18 h (02_host_wifi_outage_20261022.md:13-25). Heavy host load (the FFmpeg build, `npm ci`) is not a proven trigger; that is a hypothesis.
- Mitigation: F1 power save off, F2 ASPM and deep LPS off (verified live after the 16:07 reboot, 02_host_wifi_outage_20261022.md:58-59; the row-6 caveat was corrected by the controller, delegation_progress_report.md, wave-1 line). F3 watchdog: reload the module at 5 and 10 min, reboot from 15 min, never within 1 h of boot, never with the flag (02_host_wifi_outage_20261022.md:62). Durable fix F4, a wired admin link, is the user's call (02_structured.md:530 P2). Do not restart NetworkManager (driver_rules.md:7). Long builds run in a detached form whose state survives an SSH drop: `systemd-run --unit=<row unit> --collect`, or `nohup` with a log file. A build tied to the SSH session dies with it.
- Stop rule: before each host row, stop if either check is non-zero:
  - `sudo journalctl -b -k -g 'IO_PAGE_FAULT|failed to get tx report' --no-pager -q | wc -l`
  - `journalctl -t dems-wifi-watchdog --since -15min -g 'reload|reboot' -q | wc -l`

  During a row, if SSH drops: retry once after 60 s. If that fails, report `blocked` and wait for the user or the watchdog. Never power-cycle during an apt/dpkg run, a migration (row 44) or key provisioning (row 56).
- Rollback commands (after access returns):
```
sudo dpkg --audit && sudo dpkg --configure -a              # if the drop hit an apt row (24, 39)
# if the drop hit row 44: re-read the schema state with db:status (<DEP:row13:db_status_invocation>) before any re-run
sudo journalctl -b -1 -t dems-wifi-watchdog --no-pager | tail -20   # what the watchdog did
systemctl is-active dems-wifi-watchdog.timer                         # active
# then re-run the interrupted row from its start (each row is idempotent or states its re-run rule in row 18)
# F1-F3 themselves are pre-install host state; their rollback (02_host_wifi_outage_20261022.md:64) is NOT part of the install rollback
```

### R3. W12: the watchdog reboots the host during a recording (U-RF7, D12). Likelihood low, impact high (session cut)

- Trigger: 15 min without the wlp3s0 gateway at more than 1 h of uptime, and the flag absent (02_host_wifi_outage_20261022.md:62). Router maintenance or an AP outage is enough. The card does not have to fail.
- Mitigation: D12 U-RF7: create `/etc/dems-wifi-watchdog.noreboot` (register:101: root:root 0644, empty, row 123) before the first Core start. The module reload at 5 and 10 min still runs and does not touch enp4s0. Recommended (section 8.2): set the flag right after row 21, so that no watchdog reboot can hit a dpkg run, a build or a migration either. Trade-off (Finding 3): with the flag, a wedge ends only with the user's power key. So:
- Stop rule:
  - Before row 48 and every later row that starts the Core or a recording, stop unless `sudo test -f /etc/dems-wifi-watchdog.noreboot && stat -c '%U:%G %a' /etc/dems-wifi-watchdog.noreboot` prints `root:root 644` and `systemctl is-active dems-wifi-watchdog.timer` prints `active`.
  - A recording (rows 125-128, and any later session) runs only while the user is present at the bench (Finding 3).
  - Removing the flag while a session records is forbidden.
- Rollback commands:
```
# restore the watchdog's reboot step (only with no session recording and the Core stopped or idle):
sudo rm /etc/dems-wifi-watchdog.noreboot
systemctl is-active dems-wifi-watchdog.timer               # active
# recovery from a wedge with the flag set (user, at the host): one SHORT tap of the power key
#   -> logind HandlePowerKey=poweroff -> clean stop of dems-core.service (R10), never a long press
#   (the 10-22 reset was a long press: journal corrupted, 02_host_wifi_outage_20261022.md:37)
```

### R4. Camera LAN loss (enp4s0). Likelihood medium, impact medium (capture gap). Under R-FLEX also a credential-routing risk

- Trigger: carrier loss as seen on 10-21 19:21 (02_host_wifi_outage_20261022.md:12): a cable, the switch, or camera PoE. Under R-FLEX without RG-12, a camera address could route through Wi-Fi (Finding 4).
- Mitigation: run row 34 read-only first; record that `DEMS Camera LAN` has one address, no gateway and never-default (register:100, :180). RG-12 must be confirmed at row 96/119; it refuses off-link targets with NW-R1 (masterplan/01_specs_rflex_security.md:136). HOST-20 forwarding off (RG-14). Never edit the NM profile during a camera row.
- Stop rule: before rows 62-69, 124, 128, and each recording, stop unless:
  - `ip -br link show enp4s0` contains `UP`;
  - `ip -br -4 addr show dev enp4s0` prints exactly `192.168.100.254/24`;
  - `ip route get 192.168.100.101` names `dev enp4s0 src 192.168.100.254`;
  - each camera answers: `for a in 101 102 103 117; do timeout 2 bash -c "</dev/tcp/192.168.100.$a/554" && echo ok $a; done` prints 4 lines.

  During a row, any `enp4s0: Link is Down` in `journalctl -k --since <row start>` stops the row. If row 96 drops RG-12, any `ip route get 192.168.100.x` naming `wlp3s0` also stops the camera rows.
- Rollback commands:
```
sudo nmcli connection up "DEMS Camera LAN"                 # after the user fixed the cable/switch
# if the profile was changed by mistake: restore the copy from the Docker-era backup (root 0600) and reload
sudo install -m 0600 -o root -g root ~/dems-backup-20261021/dems-camera-lan.nmconnection /etc/NetworkManager/system-connections/dems-camera-lan.nmconnection
sudo nmcli connection reload && sudo nmcli connection up "DEMS Camera LAN"
ip -br -4 addr show dev enp4s0                             # 192.168.100.254/24
```
(The backup member name is as listed in 01_backup_and_docker_removal.md:13. Its exact path inside the folder is to be confirmed with `ls` at row 18.)

### R5. Clock: NTP only via Wi-Fi. Likelihood medium, impact medium (signing time, camera clocks, boot ordering)

- Trigger: systemd-timesyncd syncs against ntp.ubuntu.com over the Wi-Fi default route only (research/01_explore_host_survey.md:85-91). A Wi-Fi outage stops the sync. The camera LAN has no uplink. The signing instant is the host's own clock (INSTALLER-NOTE:140). Row 38 enables `systemd-time-wait-sync.service`, and `dems-core.service` is `After=time-sync.target` (service spec §4.1). If Wi-Fi is down at boot, the Core may wait. Whether `systemd-time-wait-sync` has a start timeout was not read; that is a hypothesis.
- Mitigation: rows 62-65 set the camera clocks to within 2 s of the host (02_structured.md rows 62-65). The host clock must be synchronised at that moment. Row 38 reads the wait unit's timeout: `systemctl show -p TimeoutStartUSec systemd-time-wait-sync.service`. No manual `timedatectl set-time` without the user's word: it would put an unsynchronised time into evidence.
- Stop rule: before rows 47, 48, 58, 62-65, 71, 125-128, stop unless `timedatectl show -p NTPSynchronized --value` prints `yes`. After a boot, if `systemctl is-active time-sync.target` is not `active` within 5 min, stop and report. Do not edit the unit ordering to get past it.
- Rollback commands:
```
sudo systemctl disable systemd-time-wait-sync.service      # back to the baseline state (disabled)
# and, only on the user's word, drop time-sync.target from the Core's After= line:
sudo sed -i 's/ time-sync.target//' /etc/systemd/system/dems-core.service && sudo systemctl daemon-reload
# (a deviation from HOST-PROFILE file G; record a D-id)
```

### R6. Disk. Likelihood low, impact high (PostgreSQL, journald and media share one file system)

- Trigger: `/` is one ext4 file system of 469 G, 20 G used, 426 G free (research/01_explore_host_survey.md:63-64). Media (`/opt/dems/core/.data/media/sessions`), the cluster (`/var/lib/postgresql`), the journal, the FFmpeg build tree and `/var/lib/containerd` (2.3 G, kept) all live on it.
- Mitigation: row 73 records the baseline. The FFmpeg build directory is removed after row 31; only the prefix stays. Nothing of the kept Docker data is reclaimed (R7).
- Stop rule: before rows 24, 27, 28, 44 and each recording, stop if `df --output=pcent / | tail -1 | tr -dc 0-9` is above `100 - <REQ:disk_free_threshold>` (proposal: above 80).
- Rollback commands:
```
df -h / ; sudo du -xsh /opt/dems /var/lib/postgresql /var/log/journal /home/gsp-dems 2>/dev/null
sudo journalctl --vacuum-size=500M                          # journal only; never media, never the cluster
sudo rm -rf <ffmpeg build directory declared by row 28>     # build tree only, not /opt/dems/ffmpeg-9.0.2
# media and the cluster are evidence: no deletion without the user's word
```

### R7. The kept Docker data (D7: never touched). Likelihood low, impact critical (the only Docker-era backups)

- Trigger: Finding 1.
- Mitigation: the install has no step whose path argument contains `/var/lib/docker`, `/var/lib/containerd`, `dems-backup-20261021`, `dems-change-backup-20261021.sql` or `DEMS-Linux-Docker-LCD-20261019`. The runbook (row 18) is grepped for these strings before execution and must give 0 hits outside the read-only checks of 4.2.
- Stop rule (whole install):
  - Stop if a command line holds `apt-get purge`, `apt purge`, `dpkg -P`, `dpkg --purge`, `autoremove` or `docker`.
  - Stop if a command holds `rm`, `mv`, `chown`, `chmod`, `tar -x` or `rsync --delete` with one of the five paths above.
  - At the end of each stage, run `sudo du -sb /var/lib/docker /var/lib/containerd` (it must equal `docker_kept_du.txt`) and `(cd ~/dems-backup-20261021 && sha256sum -c --quiet SHA256SUMS)` (it must print nothing). Any difference is a stop.
- Rollback commands: none should ever be needed. If a difference appears, stop all rows, change nothing further, and report to the user. Recovery source: the Mac copy, which is verified with `shasum -a 256 -c` in `/Users/gsp-budi/Documents/DEMS/.data/bench-backup-20261021`. It is copied back to the host only on the user's word, and only through a mode-0700 target.

### R8. `.data` backup scope and the tree copy (W1). Likelihood medium, impact critical (evidence store)

- Trigger: Finding 2. Rows 26 and 121 copy the tree. A re-copy after a fix (re-opened G-RF) is likely. A copy that deletes extra entries, or a recursive chown over the install dir, removes or re-owns `.data`.
- Mitigation:
  - Row 121 excludes `.data` (02_structured.md:289).
  - Row 26 copies without delete semantics and never runs a recursive owner change over `/opt/dems/core`. Ownership is set by `install -d` on the named writable paths only (service spec §2 table).
  - Backup scope after data exists: `/opt/dems/core/.data` minus `signer/`, plus `/etc/dems/core.env`, plus `pg_dump -Fc dems_demo` and the globals. `signer/` is never in a backup (INSTALLER-NOTE:146). The certificate and `handover/` are (INSTALLER-NOTE:147). D7 covered only the Docker-era backup; it is not a precedent for this one.
  - The backup is taken before every re-copy of the tree, before rows 44, 57 and 71, and before any rollback.
- Stop rule:
  - Before and after rows 26, 27, 122 and any re-copy, run `sudo stat -c '%U:%G %a' /opt/dems/core/.data`; it must print `dems-core:dems-core 700` both times.
  - After `.data` holds files, compare `sudo find /opt/dems/core/.data -type f -printf '%P %s %T@\n' | sort | sha256sum` before and after. It must be equal.
  - A copy command with `--delete`, `rm -rf /opt/dems/core`, or `chown -R ... /opt/dems/core` is a stop.
- Commands (copy form for row 26, and backup):
```
# tree copy into the install dir, no deletion, root-owned, .data excluded
S=<staging folder of row 121>
sudo tar -C "$S" --exclude=./.data -cf - . | sudo tar -C /opt/dems/core --no-same-owner --no-same-permissions -xf -
sudo install -d -o dems-core -g dems-core -m 0700 /opt/dems/core/.data /opt/dems/core/.data/media /opt/dems/core/.data/media/sessions /opt/dems/core/apps/core-server/logs
# backup (Core stopped: sudo systemctl stop dems-core.service)
K=<REQ:install_backup_dir>
sudo install -d -m 0700 -o gsp-dems -g gsp-dems "$K"
sudo tar -C /opt/dems/core --exclude=./.data/signer --numeric-owner -czf "$K"/data_without_signer.tar.gz ./.data
sudo cp -a /etc/dems/core.env "$K"/
<DEP:row13:dump_command> -Fc dems_demo > "$K"/dems_demo.pgdump   # default: sudo -u postgres pg_dump -h 127.0.0.1 -p 4432 ... per row 13's auth rule
<DEP:row13:dump_command_globals> --globals-only > "$K"/pg_globals.sql
sudo tar -tzf "$K"/data_without_signer.tar.gz | grep -c '/signer/'   # must print 0
(cd "$K" && sudo sha256sum * | sudo tee SHA256SUMS >/dev/null)
```
- Rollback commands (restore `.data`, Core stopped, on the user's word if it overwrites current data):
```
sudo systemctl stop dems-core.service
sudo tar -C /opt/dems/core --numeric-owner -xzf <REQ:install_backup_dir>/data_without_signer.tar.gz
sudo stat -c '%U:%G %a' /opt/dems/core/.data                # dems-core:dems-core 700
# signer/ is not in the backup: the live signer/ is left in place; if it is lost, a new key is made (INSTALLER-NOTE §2.13), never copied
```

### R9. First REAL_PRODUCTION boot refusal (row 58). Likelihood high (first Linux run), impact medium

- Trigger: a boot check refuses. Codes named in the sources:
  - Signing key: `CAPTURE_SIGNING_KEY_UNUSABLE`, `CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION` (INSTALLER-NOTE:45), `CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH` (INSTALLER-NOTE:192).
  - Identity: `INSTALLATION_IDENTITY_NOT_CONFIGURED` (service spec §5).
  - Host switches: `NODE_OPTIONS_SET` / `HOST_DIAGNOSTIC_SWITCH` (service spec §4.2), `REAL_CAPTURE_WITH_DEMO_CONTROLS` (service spec §5), `CAPTURE_HOST_ALIAS_SOCKET_PATH` (register:162).
  - Database port: `FOREIGN_DATABASE_PORT` (register:209).
  - Host prerequisites: host-checks.ts:108, :190-196, and the audio group check (03_deployment_check_20261022.md D4; service spec §3).
  - R-FLEX boot checks changed by rows 106 and 115 (02_structured.md:491).
- Mitigation: run the SIMULATED boot (row 48) and gates G1 and G2 first. Write the capture paths in the SIMULATED form already, so their parse rule fails early (service spec §5). The unit has no `Restart=`, so a refusal stays down and does not loop (service spec §4.1). There is no workaround key (02_structured.md:491).
- Stop rule: stop at the first refusal. Read the code with `sudo journalctl -u dems-core.service -b --no-pager -o cat | tail -40`, then route it to its owning row. Forbidden:
  - deleting or re-provisioning the signer to "start clean" (INSTALLER-NOTE:129);
  - running `evidence:dev-key` on the production data dir (INSTALLER-NOTE:45);
  - adding any key to core.env that the register marks absent;
  - a second start without a change.
- Rollback commands (back to the SIMULATED form; core.env holds no secret, so it is edited in place):
```
sudo systemctl stop dems-core.service; sudo systemctl reset-failed dems-core.service
sudo sed -i -e 's/^DEMS_CAPTURE_MODE=real$/DEMS_CAPTURE_MODE=simulated/' -e '/^DEMS_INSTALLATION_DEVICE_ID=/d' -e '/^DEMS_INSTALLATION_NAME=/d' /etc/dems/core.env
sudo grep -c -E '^(DEMS_CAPTURE_DEV_SOURCES|DEMS_DEMO_CONTROLS|NODE_OPTIONS)=' /etc/dems/core.env   # 0
sudo stat -c '%U:%G %a' /etc/dems/core.env                 # root:dems-core 640
sudo systemctl start dems-core.service && sudo journalctl -u dems-core.service -b -o cat | grep -m1 SIMULATED
```
Hypothesis: a SIMULATED boot ignores an existing production key in `.data/signer`. This is not read in code; row 18 states it, or row 48 is re-run to prove it.

### R10. tsx double-SIGTERM shutdown race (masterplan/01_specs_service.md §4.3, KillMode=mixed). Likelihood medium, impact medium (capture shutdown skipped)

- Trigger: Finding 6. Every `systemctl stop`, reboot (rows 47, 71) and power-key poweroff.
- Mitigation: `KillMode=mixed` in the unit (service spec §4.1), so SIGTERM reaches the tsx parent only and is relayed once. `TimeoutStopSec=60` is above the Core's 10 s internal timer. A session is stopped from the console before the Core is stopped.
- Stop rule: row 58 performs one idle stop:
  - `sudo systemctl stop dems-core.service`, then `sudo journalctl -u dems-core.service -b -o cat | tail -20`;
  - it must contain `shutdown complete` (index.ts:93) and must not contain `second signal during shutdown; forcing exit` (index.ts:76).

  Otherwise stop: no recording row (125-128) and no reboot with the Core enabled (row 71) until fallback B passes the same test. Never `systemctl kill` or a double stop while a session records.
- Rollback commands (switch to alternative B, service spec §4.4 / F-S2):
```
sudo cp -a /etc/systemd/system/dems-core.service <REQ:install_backup_dir>/dems-core.service.formA
sudo sed -i -e 's#^ExecStart=.*#ExecStart=/opt/dems/node-26.12.1/bin/node --import tsx src/index.ts#' -e '/^KillMode=mixed$/d' /etc/systemd/system/dems-core.service
sudo systemd-analyze verify /etc/systemd/system/dems-core.service
sudo systemctl daemon-reload && sudo systemctl start dems-core.service
# back to form A:
sudo install -m 0644 -o root -g root <REQ:install_backup_dir>/dems-core.service.formA /etc/systemd/system/dems-core.service && sudo systemctl daemon-reload
```
Note for row 59: under form A the `/proc` checks read both the MainPID and its child (service spec §4.5).

### R11. PostgreSQL install and rollback (rows 39-41, 44). Likelihood medium, impact high (cluster holds the audit chain)

- Trigger:
  - A failed or half-configured `apt` run.
  - A wrong major version: a bare `postgresql` may pull 19 or 20 (research/02_collection_pgdg.md, §4).
  - A key fingerprint that does not match: `B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8` is computed, not published (register:228).
  - Port 5432 left on, which the code refuses (register:209).
  - A rollback that purges the cluster.
- Mitigation:
  - Name the packages explicitly at the row-13 minor version (U-RF10).
  - Before `apt update`, run `gpg --show-keys --with-fingerprint` on the key file. Use `apt-get remove`, never purge, so `/var/lib/postgresql/18/main` and `/etc/postgresql/18/main` survive (hypothesis paths, register:229).
  - Dump before any rollback (R8).
  - The cluster is never inside `/opt/dems/core` (HOST-52).
- Stop rule (row 39):
  - Stop if the fingerprint line differs from the register value.
  - Stop if `apt-get -s install postgresql-18=<pin> postgresql-client-18=<pin>` plans a package whose name holds `postgresql-19` or `postgresql-20`.
  - Stop if `dpkg --audit` prints anything after the install.

  Row 40: stop unless `sudo ss -H -ltn` shows `127.0.0.1:4432` and no `:5432` and no `0.0.0.0`/`[::]` for the PostgreSQL listener.

  Row 44: stop on any non-zero exit. No manual SQL repair.
- Rollback commands:
```
# a) mid-install apt failure (row 39)
sudo dpkg --configure -a && sudo apt-get -f install          # then stop and report; no retry loop
# b) remove the server, keep the data (Core stopped first)
sudo systemctl stop dems-core.service dems-console.service
<DEP:row13:dump_command> -Fc dems_demo > <REQ:install_backup_dir>/dems_demo.pgdump      # R8; skip only if dems_demo was never created
sudo systemctl stop postgresql@18-main.service             # unit name: register hypothesis (register:113)
sudo apt-get remove postgresql-18 postgresql-client-18     # REMOVE, not purge: cluster and /etc/postgresql stay
# packages the install added as dependencies (postgresql-common, ssl-cert, libpq5 ...), from the baseline diff, never autoremove:
dpkg-query -W -f='${binary:Package}\t${Version}\t${db:Status-Abbrev}\n' | sort > /tmp/dpkg_after.txt
comm -13 <(awk -F'\t' '$3 ~ /^ii/{print $1}' <REQ:host_baseline_dir>/dpkg.txt) <(awk -F'\t' '$3 ~ /^ii/{print $1}' /tmp/dpkg_after.txt) | grep -E 'postgres|^ssl-cert|^libpq' > /tmp/pg_added.txt
cat /tmp/pg_added.txt                                      # review, then:
sudo apt-get remove $(cat /tmp/pg_added.txt)
# c) PGDG source removal
sudo rm -f /etc/apt/sources.list.d/pgdg.sources /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
sudo apt-get update
apt-cache policy postgresql-18 | grep -c apt.postgresql.org  # 0
dpkg -l 'postgresql*' | grep -c '^ii'                      # 0
sudo ls -ld /var/lib/postgresql/18/main                    # still present (kept)
# d) data dir: deleted ONLY on the user's word, after the dump is verified with pg_restore -l
#    sudo pg_dropcluster 18 main   (needs postgresql-common still installed: run before step b if the user orders deletion)
```

### R12. R-FLEX posture on the office LAN (D11). Likelihood certain (by design), impact medium

- Trigger: D10 ruling 2 "Global penuh". TYPED_PROBE and STORED_CAMERA may dial on-link devices on any eligible interface, including the office LAN on wlp3s0 (masterplan/01_specs_rflex_security.md §5). D11 accepts that the Core can dial other office devices. The residual risks are RR-1 (a typed credential sent to an office device that answers WS-Discovery) and RR-2 (a stored camera on DHCP whose address is later reused, so the stored digest goes to another device). RR-4: HOST-20 is now the only separation between the camera port and Wi-Fi.
- Mitigation (residual guards, row 89 section 3):
  - In code, recommended "keep all": RG-1 literal IPv4 only; RG-2 special classes refused; RG-3 public refused; RG-4 the host's own addresses; RG-5 edges; RG-6 port list; RG-7 scan size and spacing; RG-8 set-IP rules; RG-9 AD-02; RG-10/RG-11 helper bounds; RG-12 on-link only; RG-13 no tunnel sources. COMMISSIONING_SCAN and SET_IP stay bound to the camera interface (Q89-5).
  - On the host, the install itself provides RG-14: HOST-20 forwarding 0 (File C), HOST-24 listeners on 127.0.0.1 (4420, 4432, 5173), HOST-22 deny incoming and routed, HOST-23 only on enp4s0 (U-RF3), so no unsolicited office datagram reaches the search socket (row 89 §6), and HOST-25 loopback rule.
  - Operational rule Q89-3(a): cameras stay on the static camera port; Wi-Fi is used for testing only. The final set of guards is the user's at row 96/119. This file assumes "keep all".
- Stop rule:
  - Before row 66: stop unless gate row 119 recorded the user's posture confirmation (02_structured.md:287) and row 96 answered Q89-1..Q89-5.
  - In rows 66-69: connect only the four camera addresses 192.168.100.101/.102/.103/.117. A search result or connection that names `wlp3s0` as its interface is not adopted; stop and report.
  - After row 69, and after row 71, stop if any of these fails:
    - `sudo ss -H -tnp state established '( dport = :80 or dport = :554 )'` lists, for the Core's processes, any local address other than `192.168.100.254`;
    - `sysctl -n net.ipv4.ip_forward net.ipv6.conf.all.forwarding` does not print `0` twice;
    - `sudo ss -H -ltnp` shows anything but `127.0.0.1` for `dems-core`, `dems-console` and `postgres`;
    - `sudo ufw status numbered` shows any 3702 rule not `on enp4s0`.
- Rollback commands:
  - Host-side guard drift (for example, forwarding is on): `sudo sysctl --system` re-reads File C, then re-check. A wrong ufw rule: `sudo ufw status numbered`, then `sudo ufw --force delete <n>`.
  - Posture rollback (the user withdraws "Global penuh"): this is a code rollback and is MAJOR (02_structured.md:484). Restore the pre-R-FLEX tree on the Mac from the row-80 restore point, transfer it again (row 121 procedure), re-place it (R8 copy form), then `npm ci` (row 27). The DB migration takes the down path of the R-FLEX DB delta (`<DEP:row91:down_migration>`).
```
# Mac, on a clean tree at HEAD e05a1567 (implementation/48_rflex_restore_point.md:23-29, NOT run):
S=.data/rflex-restore-20261022
shasum -a 256 -c $S/SHA256SUMS
git apply --binary $S/tracked.diff
tar -xzf $S/untracked.tar.gz
# host: stop the Core, back up per R8, then rows 121 -> 26 (R8 copy form) -> 27 -> <DEP:row91:down_migration> -> row 48 SIMULATED boot
```

## 6. Per-stage rollback (summary for row 18 and row 77)

The rule: roll back from the latest stage backwards. Take the R8 backup before any stage that holds data (S8 onward). Never roll back S10-S12 data without the user's word.

| Stage | Rollback block |
|---|---|
| S13, S12, S11 | Data in `dems_demo`: the user changes it in the console. Camera passwords and clocks: the user only. Agent: none |
| S10 | R9 (back to SIMULATED). Key: never removed (INSTALLER-NOTE:129). Passwords: the user re-runs `operator:set-password` over `ssh -t` |
| S9 | `sudo systemctl disable --now dems-console.service dems-core.service; sudo rm -f /etc/systemd/system/dems-core.service /etc/systemd/system/dems-console.service; sudo rm -f /etc/dems/core.env; sudo systemctl daemon-reload`. The flag: R3 |
| S8 | R11 |
| S7 | `sudo gpasswd -d dems-core audio; sudo systemctl disable systemd-time-wait-sync.service` |
| S6 | R1 (`ufw --force reset` plus the baseline `ufw.conf` and `/etc/default/ufw`) |
| S5 | `sudo systemctl disable --now dems-loopback-rule.service; sudo nft delete table inet dems_loopback; sudo rm -f /etc/systemd/system/dems-loopback-rule.service /etc/dems/loopback-ingest.nft /etc/sysctl.d/60-dems-host.conf; sudo systemctl daemon-reload; sudo sysctl --system`. Then apport back to its baseline (`<DEP:row11:HOST-37_apport_file>`: restore the copied file and `sudo systemctl enable --now apport.service` if `units_enabled.txt` lists it) |
| S4 | `sudo rm -f /etc/ld.so.conf.d/dems-ffmpeg.conf && sudo ldconfig && sudo rm -rf /opt/dems/ffmpeg-9.0.2`. The worker build output goes with the tree (S3) |
| S3 | Delete the tree except `.data` (section 7 step 6). Delete the staging folder of row 121 on the user's word (it is the transfer record) |
| S2 | `sudo rm -rf /opt/dems/node-26.12.1`. Packages: the baseline diff (`comm -13` as in R11) minus PostgreSQL, reviewed, then `sudo apt-get remove ...`. Never autoremove, never purge |
| S1 | `sudo gpasswd -d dems-core dems-netalias; sudo gpasswd -d dems-core audio`. Account deletion only after `.data` has a decided fate (section 7 step 8) |
| S0 | Keep `<REQ:host_baseline_dir>` until the user closes the task |

## 7. Whole-install rollback to the pre-install state

### 7.1 R-A: profile removal plus PostgreSQL, data kept (default; on the user's word "rollback the install")

This is HOST-PROFILE §6 adapted to .73 (Finding 5), plus everything §6 does not cover. Preconditions:
- no session is recording;
- the R8 backup is taken and `sha256sum -c` passes;
- the flag is kept until step 9;
- the user's word is recorded.

```
# 1 stop and disable DEMS units
sudo systemctl disable --now dems-console.service dems-core.service dems-loopback-rule.service
# 2 unit files and /etc/dems
sudo rm -f /etc/systemd/system/dems-core.service /etc/systemd/system/dems-console.service /etc/systemd/system/dems-loopback-rule.service
sudo nft delete table inet dems_loopback 2>/dev/null; sudo rm -rf /etc/dems
sudo systemctl daemon-reload
# 3 files A and C
sudo rm -f /etc/ld.so.conf.d/dems-ffmpeg.conf /etc/sysctl.d/60-dems-host.conf
sudo ldconfig && sudo sysctl --system
#   apport to baseline (<DEP:row11:HOST-37_apport_file>)
#   NOT run on .73: `netplan apply` (file B never written; would re-apply the Wi-Fi profile over the SSH path)
#   NOT run on .73: unmasking the 4 sleep targets (masked BEFORE the install, survey:49-52)
# 4 firewall to baseline (inactive, no rules): R1 rollback
sudo ufw --force reset
sudo cp -a <REQ:host_baseline_dir>/ufw/ufw.conf /etc/ufw/ufw.conf
# 5 time
sudo systemctl disable systemd-time-wait-sync.service
# 6 PostgreSQL: R11 b) and c) (dump first; cluster kept)
# 7 tree, Node, FFmpeg: everything under /opt/dems except .data
sudo find /opt/dems/core -mindepth 1 -maxdepth 1 ! -name .data -print      # review: .data must NOT be listed
sudo find /opt/dems/core -mindepth 1 -maxdepth 1 ! -name .data -exec rm -rf {} +
sudo rm -rf /opt/dems/node-26.12.1 /opt/dems/ffmpeg-9.0.2
# 8 accounts: leave dems-core (owner of the kept .data); remove its supplementary groups and the other accounts
sudo gpasswd -d dems-core audio; sudo gpasswd -d dems-core dems-netalias
sudo userdel dems-console; sudo groupdel dems-netalias
# 9 packages added by the install (baseline diff, reviewed), never autoremove/purge
#   (comm -13 of dpkg.txt vs now, as in R11) -> sudo apt-get remove <list>
# 10 flag: part of the install (row 123), so it is removed; the watchdog's reboot step returns
sudo rm -f /etc/dems-wifi-watchdog.noreboot
```
Verification of R-A (all must hold):
- `systemctl list-unit-files 'dems-core*' 'dems-console*' 'dems-loopback*' --no-legend | wc -l` prints 0.
- `grep ^ENABLED /etc/ufw/ufw.conf` prints `ENABLED=no`.
- `sysctl -n net.ipv4.ip_forward` prints `0`. The runtime value stays 0 with no Docker present (03_deployment_check_20261022.md:10), even though File C is gone.
- `dpkg -l 'postgresql*' | grep -c ^ii` prints 0.
- `ls -A /opt/dems/core` prints `.data` only.
- `systemctl list-unit-files --state=enabled --no-legend | sort | diff - <REQ:host_baseline_dir>/units_enabled.txt` prints nothing.
- The section 4.2 checks are all equal.

What R-A deliberately leaves (the user decides each, R-B): `/opt/dems/core/.data`, the `dems-core` user and group, the cluster `/var/lib/postgresql/18/main` and `/etc/postgresql/18/main`, `<REQ:install_backup_dir>`, `<REQ:host_baseline_dir>`, the row-121 staging folder.

### 7.2 R-B: full purge to the exact pre-install state (only on a separate, explicit user word)

R-B runs after R-A, after the R8 backup is verified, and after the user is told that `signer/` is not in any backup (INSTALLER-NOTE:146), so the private key is destroyed. On this bench, no evidence was sealed in the Docker era (03_deployment_check_20261022.md D1). For the bare-metal era, this must be re-checked before R-B.
```
sudo apt-get install postgresql-common    # only if removed; needed for pg_dropcluster
sudo pg_dropcluster 18 main               # or: sudo rm -rf /var/lib/postgresql/18/main /etc/postgresql/18/main
sudo apt-get remove postgresql-common     # if it was added by the install (baseline diff)
sudo rm -rf /opt/dems/core/.data && sudo rmdir /opt/dems/core /opt/dems
sudo userdel dems-core                    # removes the group dems-core too when it is the user's primary group only
sudo find / -xdev \( -nouser -o -nogroup \) -print 2>/dev/null | head   # expect no output
diff <(cut -d: -f1 /etc/passwd | sort) <(cut -d: -f1 <REQ:host_baseline_dir>/passwd | sort)   # no difference
```

### 7.3 Restoring the Docker stack from `~/dems-backup-20261021` (only if the user wants it back)

The Docker form uses `network_mode: host` and binds 127.0.0.1:4432 (db), 4420 (core) and 5173 (console) (deploy/docker/compose.yaml:4-6, :35, :45). These are the same ports as the bare-metal install, so R-A must have run first. Docker also turns forwarding on, so HOST-20/21 no longer hold. That is expected for the Docker form, and it is recorded as a D-id.
```
# 0 preconditions
sudo ss -H -ltn '( sport = :4420 or sport = :4432 or sport = :5173 )' | wc -l   # 0
(cd ~/dems-backup-20261021 && sha256sum -c SHA256SUMS)                         # 0 failures
sudo du -sb /var/lib/docker /var/lib/containerd                                # equals baseline (volumes and images still there)
# 1 daemon settings back (file listed as "the old daemon.json" in 01_backup_and_docker_removal.md:13; exact name by ls)
ls ~/dems-backup-20261021
sudo install -d -m 0755 /etc/docker && sudo install -m 0644 ~/dems-backup-20261021/<daemon.json member> /etc/docker/daemon.json
# 2 packages (docker.sources and its key are still configured, survey:110-115); same set that was removed
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-ce-rootless-extras docker-compose-plugin
sudo docker volume ls --format '{{.Name}}' | grep -c '^dems_dems-'          # 3 (data, logs, pgdata) from the kept /var/lib/docker
sudo docker image ls | head                                                  # images from the kept /var/lib/containerd
# 3 start the stack from the kept install folder
cd ~/DEMS-Linux-Docker-LCD-20261019-amd64-unverified && ./install.sh status && ./install.sh start
# 4 only if the volumes are missing or damaged: restore from the tarballs (stack stopped), after `tar -tzf <tarball> | head` shows the member layout
#   sudo docker volume create dems_dems-data ; sudo tar --numeric-owner -xzf ~/dems-backup-20261021/vol-dems_dems-data.tar.gz -C /var/lib/docker/volumes/dems_dems-data/_data
#   (same for logs, pgdata); or pg_restore of dems_demo.pgdump into a fresh db container: procedure not in the sources -> ask before acting
```
Notes:
- `.env` still holds the REAL_DEVELOPMENT values with DEV_SOURCES=1 (03_deployment_check_20261022.md:7). The Docker-era dev key and production key share the key id CORE-KEY-EVSIGN-01 (03_deployment_check_20261022.md D1). Restoring the stack brings both facts back.
- `install.sh start` refuses without `.installed` (deploy/docker/installer/install.sh:71). `installer-config.tar.gz` holds a copy (01_backup_and_docker_removal.md:12).
- R-B and 7.3 are alternatives for `.data`. The bare-metal data dir and the Docker volume are separate stores; neither is migrated into the other.

## 8. Implementation order and recommendations

### 8.1 Order of the safety steps inside the install
1. Row 20: the baseline of 4.3, including `dpkg.txt`, `units_enabled.txt`, `docker_kept_du.txt` and the backup check. It is the source of every rollback here.
2. Row 123 moved forward to right after row 21 (see 8.2): flag set before any dpkg run.
3. Row 36 only with R1's five preconditions. The auto-revert is armed before `enable`.
4. The R8 backup before rows 44, 57 and 71, and before any re-copy of the tree.
5. Row 58's stop test (R10) before rows 71 and 125-128.
6. Gate 119 and row 96 answers (R12) before row 66.

### 8.2 Recommendations
1. **Set the no-reboot flag right after row 21**, not just before the first Core start. A watchdog reboot during apt/dpkg (rows 24, 39), the FFmpeg build (28) or a migration (44) does more damage than a wedge that waits for the user's power key. This is the only change proposed to the row order. For row 96: 96-R16-1.
2. **Make "recording only while the user is at the bench" an explicit rule** for rows 125-128 and any later session (Finding 3). For row 96: 96-R16-2.
3. **Keep RG-12 (on-link only)**. Beyond its row-89 rationale, it is what stops camera digests going to the office router when the camera LAN drops (Finding 4).
4. **Record HOST-PROFILE §6 deviations** (no unmask, no `netplan apply`) for row 78.
5. **Ask row 13 for the dump command** under its authentication rule, so R8 and R11 have a runnable form.
6. **F4, a wired admin link,** stays the durable fix for R1, R2 and R3 together (02_structured.md:530).

## 9. Risks of this assessment itself

| Risk | Mitigation |
|---|---|
| Commands are not run; the PostgreSQL paths and unit name are hypotheses (register:113, :229) | Row 18 adopts them into the runbook and states each check; row 77 re-verifies |
| Purge behaviour of the `rc` Docker packages is not read | Purge is forbidden outright (R7), so no reading is needed |
| `systemd-time-wait-sync` timeout unknown | Row 38 reads it (R5) |
| Rows 11, 13 and 91 not landed | Placeholders below; row 95 resolves them |

## 10. Acceptance criteria (row 16)
1. R1-R12 each have a mitigation, a stop rule and rollback commands (section 5). The brief's risks map as follows:
   - SSH lock-out: R1.
   - Wi-Fi wedge: R2.
   - W12: R3.
   - Camera LAN loss: R4.
   - Clock: R5.
   - Disk: R6.
   - Kept Docker data: R7.
   - `.data` scope: R8.
   - REAL_PRODUCTION refusal: R9.
   - tsx race: R10.
   - PostgreSQL: R11.
   - D11 / R-FLEX: R12.
   - Whole-install rollback and Docker restore: section 7.
2. W12 is present (R3, Findings 3, 8.2-1). D11 is present (R12, Finding 4).
3. No secret value. Install names are from the register, with four `<REQ:...>` names requested.

## For row 96

| Id | Question | Options | Recommendation |
|---|---|---|---|
| 96-R16-1 | When is the watchdog no-reboot flag set? | (a) at row 123 as planned (before the first Core start); (b) right after row 21 (before any apt/dpkg, build or migration) | (b): a reboot mid-dpkg/migration is worse than waiting for the power key during the install |
| 96-R16-2 | Recordings on the bench | (a) attended only while Wi-Fi is the only control path; (b) unattended allowed | (a) until F4 (wired admin link) exists |
| 96-R16-3 | Whole-install rollback default | (a) R-A, keeping `.data` and the cluster; (b) R-B full purge | (a); R-B only on a separate word, after the user hears that `signer/` is not backed up |
| 96-R16-4 | Docker restore after a rollback | (a) not planned, kept data stays dormant; (b) restore per 7.3 | (a) unless the user asks |

## Placeholders for row 95

| Placeholder | Where | Default taken here |
|---|---|---|
| `<DEP:row11:HOST-29_applicability>` | Finding 5, 7.1 step 3 | already satisfied before install, no change, no rollback |
| `<DEP:row11:HOST-37_apport_file>` | 4.3, section 6 S5, 7.1 step 3 | `/etc/default/apport` copied at row 20, restored at rollback (hypothesis) |
| `<DEP:row13:dump_command>`, `<DEP:row13:dump_command_globals>` | R8, R11 | `sudo -u postgres pg_dump` / `pg_dumpall` against 127.0.0.1:4432 under row 13's authentication rule |
| `<DEP:row13:db_status_invocation>` | R2 | `db:status` as the service user per row 13 |
| `<DEP:row91:down_migration>` | R12 | the R-FLEX DB delta's down/rollback statement |
| `<REQ:host_baseline_dir>`, `<REQ:install_backup_dir>`, `<REQ:ufw_revert_unit>`, `<REQ:disk_free_threshold>` | throughout | proposals in "Names and placeholders used"; requested in delegation_progress/file_requests.md |
| `<DEP:row89:guards>` | not needed | row 89 landed at 16:51; RG-1..RG-14 used directly |

---
*Generated: 2026-10-22 16:55*
*Last Updated: 2026-10-22 16:55*
