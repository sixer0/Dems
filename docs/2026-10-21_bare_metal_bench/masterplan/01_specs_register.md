---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 12
type: requirements
tier: 1
confidence: HIGH (names and constants read from code or host survey); MEDIUM where marked "hypothesis"
source_structured_task: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 12, line 180; section 1.7 W1-W13, lines 117-129)
last_updated: 2026-10-22
---

# Install names-and-constants register (row 12)

The single source of install names for rows 13-128 (driver_rules.md, "Spec waves": "install names ONLY from masterplan/01_specs_register.md"). R-FLEX names are not here; they come from masterplan/01_specs_rflex_register.md (row 87).

Paths in "Evidence" are relative to the repository root `/Users/gsp-budi/Documents/DEMS` unless they start with `research/`, `identification/` or a `0N_` host file of this task folder. Every value is either read (code, host survey, publisher), carried from a user decision (D-id), or labelled **hypothesis** or **user decides**. No secret value appears in this file. Secret slots are named and marked `SECRET - never written`.

## 0. 5W1H frame

| | |
|---|---|
| What | One value for every name and constant the bare-metal install on .73 needs: accounts, groups, directories, files with owner and mode, units, ports, ids, environment key names, version pins |
| Who | Written by data-analyst (row 12). Consumed by rows 13-16 (specs), 18 (runbook), 20-79 and 122-128 (execution), 74-78 (verification). Values marked "user decides" go to the row-96 decision sheet |
| When | Spec stage S1 (driver_rules.md, Spec waves). Before rows 13, 14, 15, 16 |
| Where | Host gsp-dems@192.168.0.73 (`gsp-dems-A520I-AC`, Ubuntu 24.04.1, x86_64; research/01_explore_host_survey.md:17) |
| Why | HOST-PROFILE §2 leaves the values to the installer (scripts/host/HOST-PROFILE-UBUNTU-24.04.md:29-40). Wave 1 found that three of them are fixed or constrained by code: data dir (W1), DB port (W2), console port (W4) (identification/02_structured.md:117-120) |
| How | Each placeholder was traced to (a) the code constant that fixes or constrains it, else (b) the profile's own proposal, else (c) the host survey, else (d) a user decision D8-D12. Alternatives are listed where a choice was made |

## 1. HOST-PROFILE §2 placeholders (verification target of this row)

The profile has eight placeholders (scripts/host/HOST-PROFILE-UBUNTU-24.04.md:31-40; the scripts mirror them in scripts/host/host-profile-lib.sh:30-37). `grep -o '<[a-z][a-z0-9-]*>'` over the profile also hits `<address>` once (line 160): it is part of an example output line (`<address> dev <camera-interface> lladdr ...`), not a placeholder of §2, and is listed in 1.2 for completeness.

### 1.1 The eight placeholders

| Placeholder | Value on .73 | Basis | Evidence |
|---|---|---|---|
| `<service-user>` | `dems-core` | Profile proposal. Not an account of an earlier input-av installation: the host has no `dems*` user or group | HOST-PROFILE:33; research/01_explore_host_survey.md:97, :104 |
| `<helper-group>` | `dems-netalias` | Fixed by the helper's delivery and by the Core's socket check, not a choice | research/01_explore_helper_absence.md:13-15 (dems-core-netalias.socket:15; dems-core-netalias:87; host-checks.ts:200); host-profile-lib.sh:37 |
| `<install-dir>` | `/opt/dems/core` | Profile proposal; same path as the packaged form. Root-owned, 0755 (HOST-05) | HOST-PROFILE:35, :57; research/01_explore_capture_build.md:48 (Dockerfile:7) |
| `<data-dir>` | `/opt/dems/core/.data` | **Fixed by code (W1)**: the Core passes no data dir to `loadConfig`, so it is always `DEFAULT_DATA_DIR` = `<install-dir>/.data`; the `db:*` commands use the same constant. Not configurable by environment or flag. The profile's "on a disk of its own" option is therefore unavailable; .73 has one ext4 file system (HOST-07 holds) | research/01_explore_core_runtime.md:33-34 (src/index.ts:58; load-config.ts:53-60); research/01_explore_database_commands.md:30; research/01_explore_host_survey.md:62-68 |
| `<ffmpeg-prefix>` | `/opt/dems/ffmpeg-9.0.2` | Profile proposal = packaged form. Root-owned | HOST-PROFILE:37; research/02_collection_ffmpeg.md:25 (Dockerfile:56, :59) |
| `<camera-interface>` | `enp4s0` | Host fact: NM profile `DEMS Camera LAN` on enp4s0, no gateway, never-default. Under R-FLEX (D10 ruling 2) this port is host hygiene, not the Core's only camera path; HOST-23 stays on this port only (U-RF3, D12) | research/01_explore_host_survey.md:134, :139, :141-142; decisions.md D10, D12 |
| `<camera-address>` | `192.168.100.254` (with `/24`) | Host fact: the static address of enp4s0 | research/01_explore_host_survey.md:139, :141 |
| `<core-pid>` | Not a constant: read at run time with `systemctl show dems-core.service -p MainPID --value` (the profile's own definition) | Runtime value | HOST-PROFILE:40 |

All eight have one value. None is left to the user.

### 1.2 Other angle-bracket names in the profile

| Name | Where | Value |
|---|---|---|
| `<address>` | HOST-PROFILE:160, inside the expected output of `ip -4 neigh show` | Not a placeholder (example output). No value needed |
| `<a.b.c.d>` / `<an address a camera answers on>` | HOST-PROFILE:160 | Example argument of a check; one of the camera addresses in 5.3 when the check is run |
| `<absolute path of node>` | File G, HOST-PROFILE:251 (`ExecStart=`) | `/opt/dems/node-26.12.1/bin/node` (section 7.1) |
| `<start arguments of the Core, to confirm in 9A/H-16>` | File G, HOST-PROFILE:251 | Row 15 decides from code (OI-5). Candidate from row 1: `/opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/tsx/dist/cli.mjs src/index.ts` with `WorkingDirectory=/opt/dems/core/apps/core-server` (hypothesis for the exact cli.mjs form; research/01_explore_core_runtime.md:23-29) |

## 2. Accounts and groups

| Name | Kind | Value | Members / notes | Evidence |
|---|---|---|---|---|
| Service user | system account, no login shell | `dems-core`, shell `/usr/sbin/nologin`, home `/nonexistent` (`--no-create-home`). **Corrected by row 17 per D16 I-01**; was `/opt/dems/core/.data` (HOST-04 sets home = data dir; recorded deviation from HOST-04) | Primary group `dems-core` (File G `Group=<service-user>`; HOST-06 group) | HOST-PROFILE:56, :58; File G; decisions.md D16 (I-01); masterplan/01_specs_service.md §3 |
| Primary group | system group | `dems-core` | created by `useradd --system` with the user | HOST-PROFILE:56 |
| Audio group | existing group | `audio` (gid 29 on .73, empty today) | `dems-core` added (HOST-26). Required by the Core's own check | research/01_explore_host_survey.md:100, :104; research/01_explore_helper_absence.md:20 |
| Helper group | system group, **group only** | `dems-netalias` | Only member `dems-core` (HOST-43). Nothing else of the helper is installed: no socket, no `/usr/local/sbin/dems-core-netalias`, no `/run/dems-core-netalias`, no `dems-core-netalias.socket` / `dems-core-netalias@.service`. Any one of these alone refuses the start | research/01_explore_helper_absence.md:18-19, :25-31, :47-49 |
| Supplementary groups of the Core | unit setting | `SupplementaryGroups=audio dems-netalias` | exactly these two (HOST-40) | HOST-PROFILE:117; File G |
| Administrator | existing login account | `gsp-dems` (uid 1000) | The agent's SSH account (D3). Not the service user; not added to `audio` or `dems-netalias` | research/01_explore_host_survey.md:97-98 |
| Console account | system account (only if row 15 chooses a separate account) | `dems-console` (proposal, Docker precedent) | Row 15 decides separate account vs `dems-core`. If separate: no login shell, not in `audio` or `dems-netalias` | research/01_explore_core_runtime.md:52 (compose.yaml:116, entrypoint:109-118) |
| PostgreSQL server account | created by the package | `postgres` (**hypothesis**: Debian/PGDG `postgresql-common` convention; not read on the host) | Owns the server data dir (HOST-52). Confirmed at row 39 | HOST-PROFILE:150; research/02_collection_pgdg.md:55 (depends on postgresql-common) |

## 3. Directories and files (path, owner, group, mode)

### 3.1 Directories

| Path | Owner:group | Mode | Note | Evidence |
|---|---|---|---|---|
| `/opt`, `/opt/dems` | root:root | 0755 | Parents of the data dir: no `w` for group/other (HOST-06) | HOST-PROFILE:58 |
| `/opt/dems/core` (install dir) | root:root | 0755 | Tree copied as root (HOST-05). The tree placement (row 26) must not replace or re-own `.data` | HOST-PROFILE:57; row 121 excludes `.data` (02_structured.md:289) |
| `/opt/dems/core/.data` (data dir) | dems-core:dems-core | 0700 | W1: fixed by code | 1.1 above |
| `/opt/dems/core/.data/media`, `/opt/dems/core/.data/media/sessions` | dems-core:dems-core | 0700 | Media store, default `<data dir>/media/sessions` | HOST-PROFILE:58; apps/core-server/src/config.ts:88 (`MEDIA_STORE_SUBPATH`) |
| `/opt/dems/core/.data/run/capture` | dems-core (created by the Core) | 0700, pipes 0600 | HOST-08; not created by the installer | HOST-PROFILE:60 |
| `/opt/dems/core/.data/signer`, `/opt/dems/core/.data/handover` | dems-core (created by `evidence:production-key`) | as the command sets | Fresh key; the Docker-era `signer.dev-backup/` is not carried over | research/01_explore_cli_invocation.md:45, :48; 03_deployment_check_20261022.md:19 |
| `/opt/dems/core/apps/core-server/logs` | dems-core:dems-core (proposal, Docker precedent) | 0700 | The Core's error log `errors.log` lives here; in a root-owned tree its write fails silently. Row 15 confirms | research/01_explore_core_runtime.md:33-34; research/01_explore_cli_invocation.md:52 |
| `/opt/dems/core/apps/core-web/node_modules/.vite` | the console account (row 15) | 0700 | Vite dependency cache, the only write of the console | research/01_explore_core_runtime.md:54 (Dockerfile:232-233) |
| `/opt/dems/ffmpeg-9.0.2` | root:root | 0755, no `w` group/other | HOST-12, HOST-16 | HOST-PROFILE:69, :73 |
| `/opt/dems/node-26.12.1` | root:root | 0755, no `w` group/other | Node install path (HOST-09: root-owned path) | section 7.1 |
| `/etc/dems` | root:root | 0755 | HOST-34 | HOST-PROFILE:111 |
| npm cache / temp for the nologin CLI runs (W6) | dems-core | 0700 | **Row 14 decides the location** (inside or outside the data dir). Key names in 6.3 | research/01_explore_cli_invocation.md:61-65; 02_structured.md:122 |

### 3.2 Files

| Path | Owner:group | Mode | Content (names only) | Evidence |
|---|---|---|---|---|
| `/opt/dems/core/.data/pg.env` (runtime settings) | dems-core:dems-core | 0600 | Five keys: `DEMS_PG_HOST`=`127.0.0.1`, `DEMS_PG_PORT`=`4432`, `DEMS_PG_DATABASE`=`dems_demo`, `DEMS_PG_APP_ROLE`=`dems_app`, `DEMS_PG_APP_PASSWORD`=SECRET - never written (OI-4 option B). The Core reads only this file for its DB settings; owner must be the calling uid, no group/other bits | apps/core-server/src/config.ts:137-145; cli/operator-set-password-command.ts:176-182; research/01_explore_database_commands.md:43-44, :53 |
| `/opt/dems/core/.data/pg.owner.env` (owner settings) | dems-core:dems-core | 0600 | Five keys: `DEMS_PG_HOST`=`127.0.0.1`, `DEMS_PG_PORT`=`4432`, `DEMS_PG_DATABASE`=`dems_demo`, `DEMS_PG_OWNER_ROLE`=`dems_owner`, `DEMS_PG_OWNER_PASSWORD`=SECRET - never written. Read only by `db:*` commands, so they run as `dems-core` (the data dir is 0700). Mode check refuses any group/other bit. **Lifetime (present only during `db:*` runs, as Docker did, or kept): row 13 decides** | apps/core-server/src/db/commands/owner-connection.ts:28, :32, :99-116; research/01_explore_database_commands.md:27-29, :58 |
| `/etc/dems/core.env` | root:dems-core | 0640 | Keys in 6.1. No DB settings in it (contrary to HOST-34/HOST-54 text, W1; recorded deviation for row 11) | HOST-PROFILE:111; research/01_explore_database_commands.md:61 |
| `/etc/dems/loopback-ingest.nft` (File D) | root:root | 0644 | nft table `inet dems_loopback`, `tcp dport 8554-8564`, `skuid != dems-core` | HOST-PROFILE:87, :197 |
| `/etc/ld.so.conf.d/dems-ffmpeg.conf` (File A) | root:root | 0644 | one line `/opt/dems/ffmpeg-9.0.2/lib` | HOST-PROFILE:70, :168 |
| `/etc/sysctl.d/60-dems-host.conf` (File C) | root:root | 0644 | forwarding off, core lines (HOST-20, HOST-37) | HOST-PROFILE:188 |
| `/etc/netplan/60-dems-camera.yaml` (File B) | - | - | **Not written on .73**: the existing NM profile `DEMS Camera LAN` (`/etc/NetworkManager/system-connections/dems-camera-lan.nmconnection`, root 0600) already gives HOST-19; row 34 checks it read-only | research/01_explore_host_survey.md:139, :143; 02_structured.md:202 |
| `/etc/systemd/logind.conf.d/60-dems-lid.conf` (File F) | - | - | **Not written**: no lid on .73 | research/01_explore_host_survey.md:18, :55 |
| `/etc/dems/netalias-interface` | - | - | **Not written**: the helper is absent; the Core does not ask for it then | research/01_explore_helper_absence.md:33 |
| `/etc/dems-wifi-watchdog.noreboot` (watchdog no-reboot flag, U-RF7) | root:root | 0644 (proposal; the watchdog tests existence only) | Empty file. Created by row 123 before the first Core start | 02_host_wifi_outage_20261022.md:62; decisions.md D12 (U-RF7) |

## 4. Systemd units

| Unit | Path | Owner, mode | State wanted | Evidence |
|---|---|---|---|---|
| `dems-core.service` (Core, File G) | `/etc/systemd/system/dems-core.service` | root root 0644 | enabled; `Requires=`/`After=dems-loopback-rule.service`; `After=time-sync.target`; plus `After=`/`Wants=` the PostgreSQL unit (HOST-56) | HOST-PROFILE:110, :118, :154; File G |
| `dems-loopback-rule.service` (File E) | `/etc/systemd/system/dems-loopback-rule.service` | root root 0644 | enabled, active (HOST-25) | HOST-PROFILE:87, :210 |
| `dems-console.service` (console, Vite dev server) | `/etc/systemd/system/dems-console.service` | root root 0644 | Name reserved here. **Unit vs recorded manual start: row 15 decides, row 122 applies** | research/01_explore_core_runtime.md:58; 02_structured.md:290 |
| PostgreSQL server unit | package-provided | - | `postgresql@18-main.service` (**hypothesis**: postgresql-common cluster naming for version 18, cluster `main`; confirmed at row 39, named in row 13) | HOST-PROFILE:154 ("unit name depends on HOST-50") |
| `systemd-time-wait-sync.service` | distribution | - | enabled (disabled today) | HOST-PROFILE:104; research/01_explore_host_survey.md:89-90 |
| `dems-wifi-watchdog.timer` / `dems-wifi-watchdog.service` | `/etc/systemd/system/` (program `/usr/local/sbin/dems-wifi-watchdog`) | existing | stays enabled and active; reboot step suppressed by the flag in 3.2 | 02_host_wifi_outage_20261022.md:60, :62; research/01_explore_host_survey.md:183-184 |
| `dems-core-netalias.socket`, `dems-core-netalias@.service` | - | - | **Must NOT exist** (helper absent) | research/01_explore_helper_absence.md:30, :49 |

## 5. Network: interfaces, addresses, ports

### 5.1 Interfaces and addresses

| Name | Value | Evidence |
|---|---|---|
| Admin / Wi-Fi interface | `wlp3s0`, `192.168.0.73/24`, default route via `192.168.0.1` | research/01_explore_host_survey.md:136, :141-142 |
| Camera interface | `enp4s0`, `192.168.100.254/24`, no gateway, never-default | research/01_explore_host_survey.md:139, :141 |
| Camera addresses | `192.168.100.101`, `.102`, `.103`, `.117` (answer on 554) | 02_host_wifi_outage_20261022.md:12; 03_deployment_check_20261022.md:23 |
| Mac (agent / user browser) | `192.168.0.14` | 02_host_wifi_outage_20261022.md:6 |

### 5.2 Ports on the host

| Port | Bound to | Owner | ufw | Evidence |
|---|---|---|---|---|
| **4420/tcp** Core | `127.0.0.1` (constant) | dems-core | no ALLOW | apps/core-server/src/config.ts:47, :49, :51; research/01_explore_core_runtime.md:35 |
| 4421-4423/tcp | unused (lane instances) | - | no ALLOW | config.ts:48-49 |
| **5173/tcp** console (Vite dev server, W4) | `127.0.0.1`, strictPort | console account | no ALLOW | research/01_explore_core_runtime.md:41, :48; config.ts:101-102 (`WEB_CONSOLE_ORIGINS`, exact string `http://127.0.0.1:5173`) |
| 4173/tcp | not used (Vite preview) | - | - | research/01_explore_core_runtime.md:48 |
| **4432/tcp** PostgreSQL (W2) | `127.0.0.1` | postgres | no ALLOW | Chosen value, see 5.4 |
| 8554-8564/tcp | `127.0.0.1` worker camera listeners | dems-core only (nft rule) | - | HOST-PROFILE:87 |
| 22/tcp SSH | sshd | - | ALLOW in on `wlp3s0` only (D5, HOST-22; row 36) | **hypothesis** that sshd uses the default 22 (sshd_config not read; the agent's SSH calls use no `-p`) |
| 3702/udp source port | WS-Discovery answers | - | `allow in on enp4s0 proto udp from any port 3702` (HOST-23, U-RF3: camera port only) | HOST-PROFILE:85; decisions.md D12 |

### 5.3 SSH forward ports (OI-2, F7)

| Purpose | Mac command (key and account as in driver_rules.md) | Constraint | Evidence |
|---|---|---|---|
| Console (OI-2) | `ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -N -L 5173:127.0.0.1:5173 gsp-dems@192.168.0.73`, browser at `http://127.0.0.1:5173` (never `localhost`), Live mode | **Local port must be 5173**: the Core's Origin guard accepts the exact string `http://127.0.0.1:5173`. Forward to the console port, not to 4420. Port 5173 must be free on the Mac while forwarding | research/01_explore_core_runtime.md:50, :53, :59; deploy/docker/README.md:115; config.ts:101-102 |
| Camera pages (F7, rows 62-65) | `-L 18101:192.168.100.101:80 -L 18102:192.168.100.102:80 -L 18103:192.168.100.103:80 -L 18117:192.168.100.117:80` (local port = 18000 + last octet) | Local ports are a proposal (free choice, no code constraint). Camera web port 80 is a **hypothesis**, confirmed at row 62. sshd forwards from the host; IP forwarding stays 0 (D8, F7) | decisions.md D8 (F7); 02_structured.md:77 (F7) |

### 5.4 Database port choice (W2)

| | |
|---|---|
| Value | `4432` |
| Rule | Port 5432 is refused by the Core, the `db:*` commands and `operator:set-password` (`FOREIGN_DATABASE_PORT`); host must be the literal `127.0.0.1` (`localhost` refused) |
| Evidence of the rule | apps/core-server/src/config.ts:126, :132, :386-389; research/01_explore_database_commands.md:29, :62-63 |
| Why 4432 | The project's own value in every other form: macOS dev cluster (scripts/pg/init.mjs:7; scripts/pg/lib.test.mjs:42-43) and the Docker package (deploy/docker/compose.yaml:45; deploy/docker/.env.example:12-13 "Never 5432"). No collision on .73 (no listener besides resolved/cups on loopback: 02_host_wifi_outage_20261022.md:45) |
| Alternatives | Any 1-65535 except 5432 is accepted by code (research/01_explore_database_commands.md:29). 5432 with a second server: refused. Rejected: a new number would differ from every documented form for no gain |
| Applied by | row 13 (spec), row 40 (`port = 4432`, `listen_addresses = '127.0.0.1'`) |

## 6. Environment key names

Names only, from row 1 (research/01_explore_core_runtime.md:65-101). "Register value" gives the value where it is a non-secret constant of this register; the inclusion decision per key is row 15's.

### 6.1 `/etc/dems/core.env` (read by the Core via `EnvironmentFile=`)

| Key | Register value | Form at row 42 (SIMULATED) / row 57 (REAL) | Evidence |
|---|---|---|---|
| `DEMS_CORE_PORT` | `4420` | both | config.ts:61; load-config.ts:76 |
| `DEMS_CAPTURE_MODE` | `simulated` / `real` | row 42 / row 57 | config.ts:65 |
| `DEMS_CAPTURE_WORKER` | `/opt/dems/core/apps/capture-worker/build/capture-worker` | REAL | config.ts:66; research/01_explore_capture_build.md:19, :48 |
| `DEMS_CAPTURE_RELAY` | `/opt/dems/core/apps/capture-worker/build/capture-relay` | REAL | config.ts:73; capture_build:20 |
| `DEMS_CAPTURE_GUARD` | `/opt/dems/core/apps/capture-worker/build/capture-guard` | REAL | config.ts:74; capture_build:21 |
| `DEMS_CAPTURE_AUDIO_HELPER` | `/opt/dems/ffmpeg-9.0.2/bin/ffmpeg` | REAL | config.ts:76; HOST-PROFILE:73 |
| `DEMS_MEDIA_DIR` | `/opt/dems/core/.data/media/sessions` (the default, written absolute) | both | config.ts:67, :88 |
| `DEMS_INSTALLATION_DEVICE_ID` | `DEMS-BENCH-01` (section 8) | REAL (required in REAL_PRODUCTION) | config.ts:71, :319; 02_structured.md:158 |
| `DEMS_INSTALLATION_NAME` | **user decides** (1-120 printable characters) | REAL (required in REAL_PRODUCTION) | config.ts:72, :326; installation-identity.ts:18-21 |
| `DEMS_LOG_LEVEL` | optional; row 15 decides | - | config.ts:63 |
| `DEMS_CAPTURE_HELPER_FFMPEG` | row 15 decides from code (role of the key not opened in wave 1) | - | config.ts:69 |
| `DEMS_CAPTURE_ALIAS_SOCKET` | **absent** (helper absent; any other value than `/run/dems-core-netalias/socket` refuses) | absent | HOST-PROFILE:111; research/01_explore_helper_absence.md:43 |
| `DEMS_CAPTURE_DEV_SOURCES`, `DEMS_CAPTURE_DEV_FAKE_MIC` | **absent** (development switches; HOST-34 grep target) | absent | config.ts:68, :70; HOST-PROFILE:111 |
| `DEMS_DEMO_CONTROLS` | absent (proposal; row 15 confirms) | absent | config.ts:62 |
| `DEMS_LCD_BACKEND_URL` | absent (LCD out of scope) | absent | config.ts:64 |
| `NODE_OPTIONS` | **must be absent**, even empty (refusal `NODE_OPTIONS_SET`) | absent | research/01_explore_core_runtime.md:32 |
| `PG*` | none (deleted at start, never used) | absent | research/01_explore_core_runtime.md:92 |

### 6.2 Console process

| Key | Register value | Evidence |
|---|---|---|
| `DEMS_CORE_PROXY_PORT` | `4420` | research/01_explore_core_runtime.md:49, :101 |
| `VITE_DEMS_CORE_ORIGIN` | not set (build-time only; no bundle is served) | research/01_explore_core_runtime.md:51, :101 |

### 6.3 CLI runs as the nologin service user (W6)

| Key | Value | Evidence |
|---|---|---|
| `npm_config_cache`, `TMPDIR`, `HOME` | **row 14 decides** (location, ownership); names from the row-4 derivation | research/01_explore_cli_invocation.md:61-65 |
| Any name matching the password pattern | must be absent (refused by `operator:set-password`) | research/01_explore_cli_invocation.md:36 |

`evidence:production-key` reads no environment variable and refuses root (W5): it runs as `dems-core` with `--data-dir /opt/dems/core/.data` (research/01_explore_cli_invocation.md:35, :46-47).

## 7. Version pins

### 7.1 Node.js (U-RF8)

| | |
|---|---|
| Pin | **26.12.1** |
| Range test | Root `package.json:6-8` engines `>=26.8.2 <27`; 26.12.1 is >= 26.8.2 and < 27: **inside**. The D12 condition holds (research/02_collection_node.md:13, :19) |
| Release | v26.12.1, 2026-10-21, `security=true` in the nodejs.org index (research/02_collection_node.md:19) |
| Archive | `node-v26.12.1-linux-x64.tar.xz` from `https://nodejs.org/dist/v26.12.1/` (URL pattern derived from the 26.8.2 URLs, research/02_collection_node.md:24-28; the 26.12.1 directory itself was fetched for its SHASUMS line only) |
| sha256 (publisher line, public) | `6170b2d474e1c626f43cff3adc118df9fe3b573258a4fc3d850c8dbc6b079bbd  node-v26.12.1-linux-x64.tar.xz` (research/02_collection_node.md:21) |
| Install path | `/opt/dems/node-26.12.1` (root-owned); binary `/opt/dems/node-26.12.1/bin/node`, npm beside it. Path is a proposal (HOST-09 names only "a root-owned path") |
| Check | `node --version` prints `v26.12.1` |
| Deviation | `.node-version` (26.8.2) and HOST-09 text (`v26.8.2`) differ from the pin; covered by D12 U-RF8. Signature check: key list from the GitHub README (W11, research/02_collection_node.md:43-61) |

### 7.2 FFmpeg (U-RF9)

| | |
|---|---|
| Version | **9.0.2** (libavformat **63.1.102**), build-enforced pin (research/01_explore_capture_build.md:37-38) |
| Licence configuration | **LGPL default**: `./configure --prefix=/opt/dems/ffmpeg-9.0.2 --enable-shared --disable-static --disable-doc --enable-indev=alsa`, no `--enable-gpl` / `--enable-version3` / `--enable-nonfree` (D12 U-RF9; research/02_collection_ffmpeg.md:28, :33) |
| Archive / signature / key | `https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz`, `.asc`, key fingerprint `FCF986EA15E6E293A5644F10B4322F04D67658D8` (research/02_collection_ffmpeg.md:15-18) |
| sha256 (repo pin, public) | `8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e` (Dockerfile:57 via research/02_collection_ffmpeg.md:26; ffmpeg.org publishes none) |

### 7.3 PostgreSQL (U-RF10)

| | |
|---|---|
| Major | **18** (packages `postgresql-18`, `postgresql-client-18`, named explicitly; a bare `postgresql` may point at 19/20) |
| Minor | **Decided by row 13** (D12 U-RF10). Candidates in PGDG noble on 2026-10-19: `18.4-1.pgdg24.04+1` (the version migrations and DB tests ran on) and `18.6-1.pgdg24.04+2` (current) (research/02_collection_pgdg.md:51, :56) |
| Source file | `/etc/apt/sources.list.d/pgdg.sources`, suite `noble-pgdg`, `Signed-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc` (research/02_collection_pgdg.md:24-36) |
| Key fingerprint | `B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8`: computed, not published; **hypothesis** until `gpg` on the host (row 39) (research/02_collection_pgdg.md:43-45) |
| Server data dir | `/var/lib/postgresql/18/main` (**hypothesis**: package default under `/var/lib/postgresql`, HOST-PROFILE:150; not inside `/opt/dems/core`, HOST-52). Row 13 confirms |

## 8. Database names and roles

| Name | Value | Evidence |
|---|---|---|
| Database | `dems_demo`: in the closed list `PROJECT_DATABASES = ['dems_demo', 'dems_lane_1', 'dems_lane_2', 'dems_lane_3']`, and the one the Core on port 4420 serves | apps/core-server/src/db/commands/database-names.ts:18; config.ts:147-150; HOST-PROFILE:153 |
| Owner role | `dems_owner` (not superuser; create, migrate, seed) | owner-connection.ts:28 |
| Runtime role | `dems_app` (the Core and `operator:set-password`) | config.ts:134 |
| Maintenance DB | `postgres` (used by `db:*` for checks) | research/01_explore_database_commands.md:32 |
| Docker-era admin role `dems_admin` | **not created** on bare metal; the server's own `postgres` superuser is used for role creation (row 13/41) | deploy/docker/compose.yaml:51 (Docker only) |

## 9. Installation identity

| | |
|---|---|
| Device id | `DEMS-BENCH-01` (02_structured.md:158) |
| Grammar check | Matches `^[A-Z][A-Z0-9-]{0,31}$` (apps/core-server/src/config.ts:319) |
| Reserved list check | Not reserved. Reserved ids are `DEMS-TEST-01`, `DEMS-IR-01`, `DEMS-JKT-07` (apps/core-server/src/capture/boot/checks.ts:423-430); production start refuses them (checks.ts:627-628), and so does `evidence:production-key` (cli/production-key-command.ts:461) |
| Display name | **user decides** (`DEMS_INSTALLATION_NAME`); the organisation name of the key is typed by the user (OI-3) |
| Note | The Docker-era production certificate also named DEMS-BENCH-01 (03_deployment_check_20261022.md:19). A fresh key is made in the new data dir; old signer folders are not carried over |

## 10. Assumptions, gaps, alternatives

| # | Item | Status | Owner |
|---|---|---|---|
| G1 | sshd port 22 | hypothesis (not read) | row 36 reads `sshd -T` before ufw |
| G2 | PostgreSQL unit name, server account, data dir | hypothesis (postgresql-common convention) | rows 13, 39 |
| G3 | Camera web port 80 | hypothesis | row 62 |
| G4 | Exact ExecStart form | candidate from code, not run | rows 15, 58 (OI-5) |
| G5 | `DEMS_CAPTURE_HELPER_FFMPEG` role | not opened in wave 1 | row 15 |
| G6 | pg.owner.env lifetime | open | row 13 |
| G7 | npm/tsx cache location for the nologin user | open | row 14 |
| G8 | Console account and unit vs manual start | open | rows 15, 122 |
| A1 | Install dir `/opt/dems/core` over alternatives (`/srv/dems`, home dir): chosen because the profile proposes it, the packaged form uses it, and `/home/gsp-dems` would give the data dir a parent owned by a login user (HOST-06 fails) | decided here | - |
| A2 | The tree placed in row 26 does not contain `.data` (row 121 excludes it), so the data dir made in row 22 survives the copy; row 26 must copy without deleting extra entries | constraint on row 26 | row 26 |

## For row 96

| # | Question | Options | Recommendation |
|---|---|---|---|
| 96-R12-1 | Display name of the installation (`DEMS_INSTALLATION_NAME`) | any 1-120 printable characters typed by the user | The user types it at row 57, as with the organisation name (OI-3) |
| 96-R12-2 | Local ports of the camera-page forwards | 18101/18102/18103/18117 (proposal) / user's own | Keep the proposal unless taken on the Mac |

## 11. Additions by row 17 (install reconciliation, 2026-10-22)

Additive section. Sections 0-10 are unchanged, except line 63 (service user home), corrected in place per decisions.md D16 (I-01). Source of every entry: `masterplan/01_specs.md` (row 17), which cites the delta and ruling behind each value. No secret value.

### 11.1 Names added

| Name | Value | Owner, mode / meaning | Requested by | Evidence |
|---|---|---|---|---|
| `ufw_revert_unit` | `dems-ufw-revert` | transient `systemd-run` unit (timer `dems-ufw-revert.timer`, service `dems-ufw-revert.service`) that runs `/usr/sbin/ufw --force disable` 300 s after arming unless stopped; exists only between row 36 steps R5 and R8 | rows 14, 16 | masterplan/01_specs_security.md §2.2; research/03_analysis_impact.md R1; 01_specs.md C-2 |
| `pg_socket_dir` | `/var/run/postgresql` | PostgreSQL unix socket directory; socket `.s.PGSQL.4432` owner `postgres`, `unix_socket_permissions = 0700`; used only by `postgres` with peer auth. **Hypothesis** (package default) until row 39 | row 13 | masterplan/01_specs_database.md §3.1 |
| `pg_conf_dir` | `/etc/postgresql/18/main` | cluster config dir: `postgresql.conf`, `pg_hba.conf`, `start.conf`. **Hypothesis** until row 39 | row 13 | 01_specs_database.md §3.2, §7 |
| `pg_common_conf` | `/etc/postgresql-common/createcluster.conf` | holds `create_main_cluster = false` before the server package is installed. **Hypothesis** until row 39 | row 13 | 01_specs_database.md §7 HOST-51 |
| `pg_log_file` | `/var/log/postgresql/postgresql-18-main.log` | server log of cluster 18/main, packaged logrotate. **Hypothesis** until row 39 | row 13 | 01_specs_database.md §3.1 |
| `host_baseline_dir` | `/home/gsp-dems/dems-host-baseline-<YYYYMMDD>` | `gsp-dems:gsp-dems` 0700; `<YYYYMMDD>` = host local date at the start of row 20; exactly one folder; layout mirrors absolute paths (`cp -a --parents`, e.g. `<dir>/etc/ufw/ufw.conf`); holds `/etc/shadow` copies, never copied off-host | row 16 | research/03_analysis_impact.md §4.3; 01_specs.md C-3 |
| `install_backup_dir` | `/home/gsp-dems/dems-install-backup-<YYYYMMDD-HHMM>` | `gsp-dems:gsp-dems` 0700; one folder per backup (before rows 44, 57, 71, any tree re-copy, any rollback); members `data_without_signer.tar.gz`, `core.env`, `dems_demo.pgdump`, `pg_globals.sql`, `SHA256SUMS`; never holds `signer/` | row 16 | research/03_analysis_impact.md R8; 01_specs.md SI-29 |
| `disk_free_threshold` | `20 %` free on `/` | stop when the used share of `/` is above 80 | row 16 | research/03_analysis_impact.md R6 |
| `tree_staging_dir` | `/home/gsp-dems/dems-tree-staging-<YYYYMMDD>` | `gsp-dems:gsp-dems` 0700; row 121 transfer target (`.git`, `node_modules`, `.data`, `docs` excluded); source of row 26; kept as the transfer record until the user closes the task | row 17 (closes research/03_analysis_impact.md R8 `<staging folder of row 121>`) | 02_structured.md row 121 ("NEW under /home/gsp-dems/") |
| `ffmpeg_build_dir` | `/home/gsp-dems/dems-ffmpeg-build-9.0.2` | `gsp-dems:gsp-dems` 0700; FFmpeg archive, signature and source tree of row 28; removed after row 31 (the prefix `/opt/dems/ffmpeg-9.0.2` stays) | row 17 (closes R6 `<ffmpeg build directory declared by row 28>`) | research/03_analysis_impact.md R6 |
| `host_build_unit` | `dems-host-build-row<NN>` | transient unit name for a detached long run (`systemd-run --unit=dems-host-build-row28 --collect ...`), `<NN>` = blueprint row number | row 17 (closes R2 `<row unit>`) | research/03_analysis_impact.md R2 |
| `VITE_DEMS_CORE_MODE` (console process, §6.2) | `live` | set by `Environment=` in `dems-console.service`; selects Live mode | row 17 (used by row 15, missing in §6.2) | masterplan/01_specs_service.md §8.3; `apps/core-web/src/runtime/env.d.ts:13`; `apps/core-web/src/runtime/core-mode.ts:13` |

### 11.2 Names not registered

| Name | Why |
|---|---|
| `cli_cache_dir` | Not used: the CLI runs in the direct-tsx form (decisions.md D16 I-03), which needs no npm cache. Was held by the controller ruling in delegation_progress/file_requests.md |

### 11.3 Status of entries above after row 17 (decided by rows 13-16 and D16)

| Entry | Now |
|---|---|
| §2 Console account `dems-console` (proposal) | **decided**: separate account, `--system --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin`, no supplementary group (01_specs_service.md §3) |
| §3.1 npm cache / temp for the nologin CLI runs ("row 14 decides") | **none created**; tsx writes `/tmp/tsx-<uid>` (owner `dems-core`, `UMask=0077`; hypothesis until rows 54/58) (01_specs_security.md §4) |
| §3.2 `pg.owner.env` lifetime ("row 13 decides") | **present only during an owner run**; `dems_owner` has `PASSWORD NULL` between runs (01_specs_database.md §4.3; D16 I-16) |
| §3.2 watchdog flag "created by row 123 before the first Core start" | created **right after row 21** (D16 I-17) |
| §4 `dems-console.service` ("row 15 decides, row 122 applies") | **unit, enabled** (D16 I-04) |
| §5.3 forwards | Mac side bound explicitly: `-L 127.0.0.1:5173:127.0.0.1:5173`; camera pages `-L 127.0.0.1:18101:192.168.100.101:80` (and 18102, 18103, 18117) (01_specs_security.md §1 S2, S4; D16 I-14) |
| §6.1 `DEMS_CAPTURE_WORKER`, `_RELAY`, `_GUARD`, `_AUDIO_HELPER` ("REAL") | set in **both** forms (01_specs_service.md §5) |
| §6.1 `DEMS_LOG_LEVEL`, `DEMS_CAPTURE_HELPER_FFMPEG`, `DEMS_DEMO_CONTROLS` ("row 15 decides") | **absent** in both forms |
| §6.3 `npm_config_cache`, `TMPDIR`, `HOME` ("row 14 decides") | not set for the CLI; the console unit sets `HOME=/nonexistent` |
| §7.3 PostgreSQL minor ("decided by row 13") | **`18.6-1.pgdg24.04+2`**, held with `apt-mark hold`; fallback `18.4-1.pgdg24.04+1` per 01_specs_database.md §2.2 (D16 I-16) |
| §10 G4 ExecStart | `/opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/tsx/dist/cli.mjs src/index.ts` + `KillMode=mixed`; fallback `node --import tsx src/index.ts` if row 58's stop test fails (D16 I-02) |
| §10 G5 `DEMS_CAPTURE_HELPER_FFMPEG` | absent (development-fence key) |
| §10 G6, G7, G8 | closed as above |

Conflict check before this edit: every name in 11.1 was grepped in this register (0 hits), in `masterplan/01_specs_rflex_register.md` (0 definitions; the eight requested names appear only in its line "Not added (INSTALL register, rows 12/17)") and in `apps/`, `packages/`, `scripts/`, `deploy/` (0 hits; `VITE_DEMS_CORE_MODE` is the existing code key it names). Result: 0 name conflicts.

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22 (row 17: line 63 corrected, section 11 added)*
