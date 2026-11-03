---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 11
type: requirements (applicability matrix)
tier: 1
confidence: MEDIUM. Host facts come from a read-only survey (HIGH). Every profile item is still unverified on Ubuntu (HOST-PROFILE:3). HOST-19..25/46 cite row 93 (masterplan/01_specs_rflex_host_docs.md)
source_translated_task: docs/2026-10-21_bare_metal_bench/identification/01_translated.md
source_structured_task: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 11, line 179; W1-W13 lines 113-129)
last_updated: 2026-10-22 17:15
---

# HOST-01..HOST-56 applicability matrix for the bare-metal install on .73 (row 11)

## Source Tasks
- Structured: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 11)
- Translated: docs/2026-10-21_bare_metal_bench/identification/01_translated.md (Goal 1, AC1)
- Original: docs/2026-10-21_bare_metal_bench/identification/01_original.md

## Exploration & Collection Summary
- Explore: research/01_explore_core_runtime.md (row 1), 01_explore_database_commands.md (2), 01_explore_capture_build.md (3), 01_explore_cli_invocation.md (4), 01_explore_helper_absence.md (5), 01_explore_host_survey.md (6), 01_explore_source_tree_state.md (7), 01_explore_rflex_network_ui_docs.md (85)
- Collection: research/02_collection_node.md, 02_collection_ffmpeg.md, 02_collection_pgdg.md
- Specs used: masterplan/01_specs_register.md (row 12, names), masterplan/01_specs_service.md (row 15), masterplan/01_specs_rflex_network.md (row 90) and masterplan/01_specs_rflex_security.md (row 89). Both of the last two landed while this row was running and are used for context only
- Host files: 01_backup_and_docker_removal.md, 02_host_wifi_outage_20261022.md, 03_deployment_check_20261022.md
- masterplan/01_specs_rflex_host_docs.md (row 93): absent at the first draft, landed 16:51. Per D13 its verdicts (section 3, lines 63-70) are used directly. They equal the D12 defaults of the draft, so no line changed status. No `<DEP:row93>` placeholder remains

## Overview

This file classifies every item of the host profile (scripts/host/HOST-PROFILE-UBUNTU-24.04.md:46-154) for host .73 in one of three ways. It also places the PREP and 9A/H checks of the acceptance package in or out of this task's scope. Of the 56 items, 36 apply, 5 apply in part, and 11 apply with a deviation (D-id or proposed). Four are N/A: HOST-30 (no lid), HOST-44 and HOST-45 (helper absent, absence checked instead), and HOST-46 (helper absent, row 93). The deviations that weigh most are W1 (the data dir is fixed at `/opt/dems/core/.data`, which hits HOST-34, HOST-54 and DB-05) and the R-FLEX reading of HOST-19..23 (host hygiene, not a Core guard).

## 5W1H frame

| | |
|---|---|
| What | One line per HOST item: status, reason, D-id, the row that applies it, and the evidence. It also states the in or out scope of PREP-01..14 and 9A/H-01..27 |
| Who | Written by data-analyst (row 11). Consumers: row 16 (impact), 17 (reconcile), 18 (runbook), 19 (refinement), 46 (gate G1 uses this as the AC1 matrix), 74/78 (verification, deviation register). Proposed deviations go to the user through row 96 |
| When | Spec stage S3 (driver_rules.md, Spec waves). It runs beside rows 88-94 under D13. Valid for the install rows 20-79 and 122-128 |
| Where | Host gsp-dems@192.168.0.73, Ubuntu 24.04.1, x86_64, one ext4 disk, no lid (research/01_explore_host_survey.md:17-26) |
| Why | AC1 asks for every applicable HOST check and a reason for every N/A (01_translated.md:57). Wave 1 and R-FLEX changed several items (W1, W13, D10-D12) |
| How | Each item's text (HOST-PROFILE line) is compared with the host fact (survey, 02_ and 03_ host files), the code fact (rows 1-5), the register value (row 12), the service spec (row 15) and decisions D3-D13. A status is "applicable" when the profile's command and check run as written with the register values. "Deviation" means the command, the file or the check differs. "N/A" means the item's subject does not exist on this host or in this scope |
| Alternatives | For each deviation, keeping the profile's letter is the alternative. Its cost is given in the reason column |
| Assumptions | A1-A10 as approved in D8. The changed tree comes from row 121 (R2-5). U-RF5: no second mic. U-RF6: no overlap |

## Status legend and deviation ids

- **applicable**: the profile command and check apply as written, with register values substituted.
- **applicable (partial)**: part of the check cannot run in this task's scope. The part and its reason are named.
- **deviation**: the item applies, but the command, file or check differs. The deviation carries an existing D-id, or a proposed id `PD-11-nn` for the controller to record or to put to the user at row 96.
- **N/A**: the item does not apply on .73 in this task. A reason is given.
- Row 93 verdicts (KEPT / amended) are cited per line from masterplan/01_specs_rflex_host_docs.md.

Approved ids used: D2 (Docker removed), D3 (agent performs host steps), D5 (Wi-Fi stays up), D8 (A3 PGDG, A7 no helper, A8 NM profile instead of file B, A9 SSH rule first, OI-4, OI-5, F7), D10/D11 (R-FLEX), D12 (U-RF3, U-RF5, U-RF8, U-RF9, U-RF10).

## The matrix (56 items)

Paths and names are taken from masterplan/01_specs_register.md (cited as "reg:line"). "SPEC" means masterplan/01_specs_service.md. "HP" means scripts/host/HOST-PROFILE-UBUNTU-24.04.md. "Survey" means research/01_explore_host_survey.md.

| Id | Item (short) | Status | Reason / deviation | Applied / checked by row | Evidence |
|---|---|---|---|---|---|
| HOST-01 | Ubuntu 24.04 LTS; `uname -m` recorded | applicable | The host is Ubuntu 24.04.1 LTS, x86_64. Expected PASS | 21 | Survey:17, :31-32; HP:48 |
| HOST-02 | No input-av installation | applicable | No DEMS unit, no `dems-netalias` sudoers line seen. The Wi-Fi watchdog units `dems-wifi-watchdog.*` do not match the check's patterns (`dems-nvr*`, `dems-mediamtx*`). Expected PASS | 21 | Survey:175, :183; 02_host_wifi_outage_20261022.md:60; HP:49 |
| HOST-03 | Only one interactive admin account | applicable | One login account, `gsp-dems` (uid 1000). The system accounts' shells were not listed beyond uid >= 1000, so `root`/`sync`-only is a **hypothesis** until row 21 runs the awk check. The accounts added later, `dems-core` and `dems-console`, are nologin (reg:63, :69) | 21 | Survey:95-98; HP:50 |
| HOST-04 | System account without login shell | deviation (proposed **F-S1**, row 15) | The account is `dems-core` with shell `/usr/sbin/nologin`. HP:56 sets home = `<data-dir>`. The register (reg:63) keeps the profile's home `/opt/dems/core/.data`, while SPEC §3 proposes `/nonexistent` so that tool caches stay out of the evidence store (W1). This conflict is open for rows 17 and 96. The check (`getent` ends with nologin) passes either way | 22 | reg:63; SPEC:35, :79, :323; HP:56 |
| HOST-05 | Product tree root-owned, not writable by the service user | deviation (proposed **PD-11-01**) | `/opt/dems/core` is root 0755, and the tree comes from the row-121 staging copy (R2-5). Three paths inside the tree are writable by the service accounts: `.data` (W1), `apps/core-server/logs` and `apps/core-web/node_modules/.vite` (SPEC §2 table, Docker precedent). The namei check on the worker path still passes. The deviation is to the item's wording, not to its check | 22, 26, 27 | reg:79-85; SPEC:57-69; HP:57 |
| HOST-06 | Data dir owner-only; no group/other `w` on any parent | deviation (**W1**, proposed **PD-11-02**) | The data dir is fixed by code at `/opt/dems/core/.data` and cannot be set by env or flag (W1). The profile's "on a disk of its own if possible" is therefore unavailable. The parents `/opt/dems/core`, `/opt/dems` and `/opt` must be root 0755. The checks run as written with that path | 22 | reg:42, :78-81; research/01_explore_core_runtime.md:34; HP:36, :58 |
| HOST-07 | Evidence volume: hard links, exclusive create, durable sync | applicable (partial) | `/` is local ext4 on NVMe and is the only file system (W1 places the data dir on it). `findmnt` and "no `NO_HARD_LINKS`/`NO_SYNC`" are read at the first REAL boot (row 58). The sync level (9A/H-03) is out of scope because there is no pusher (see 9A/H list) | 22, 58 | Survey:19, :62-68; HP:59 |
| HOST-08 | Run dir 0700, mic pipes 0600 | applicable (partial) | The Core creates `.data/run/capture`, and `UMask=0077` is in file G (SPEC:106). The checks "pipes 0600 / at least 1 pipe" need a running session, which is out of scope (A1, U-RF5: one mic, no 4-slot session). Only the directory-mode part is checked, after the boot | 58, 59 | SPEC:66; HP:60; 02_structured.md:64 |
| HOST-09 | Node.js pinned, root-owned path | deviation (**D12 U-RF8**, W11) | The pin is 26.12.1, not 26.8.2. It sits inside engines `>=26.8.2 <27` and is installed at `/opt/dems/node-26.12.1`. The check prints `v26.12.1`, not the profile's `v26.8.2`. The signing-key list comes from the GitHub README (W11) | 25 | reg:208-215; research/02_collection_node.md:13, :19, :21; HP:66 |
| HOST-10 | Build tools (`build-essential clang make pkg-config python3 nasm libasound2-dev`) | applicable | Missing today: build-essential, gcc, make, pkg-config, nasm. Present: python3 3.12.3. `clang` and `libasound2-dev` were not in the survey's list, so they count as missing (**hypothesis**). Row 24 installs them | 24 | Survey:25, :154-157; 03_deployment_check_20261022.md:22 (D4); HP:67 |
| HOST-11 | Distribution FFmpeg dev packages absent | applicable | ffmpeg and ffprobe are absent. `libavformat-dev` was not queried by name (**hypothesis**: absent). Row 24 checks `dpkg -s libavformat-dev` | 24 | Survey:155-156; HP:68 |
| HOST-12 | FFmpeg 9.0.2 built from source into the prefix | applicable (with **D12 U-RF9** licence choice) | The prefix is `/opt/dems/ffmpeg-9.0.2`. The configure line is exactly the profile's, with LGPL default (no `--enable-gpl`). The archive is verified by signature (key FCF986EA...) and the repo sha256 pin | 28 | reg:220-224; research/02_collection_ffmpeg.md:15-28; HP:69 |
| HOST-13 | Loader finds the pinned libraries (file A) | applicable | File A contains one line, `/opt/dems/ffmpeg-9.0.2/lib`, root 0644, followed by `ldconfig` | 28 | reg:99; SPEC:192; HP:70 |
| HOST-14 | Worker built against the pinned library | deviation of check form (proposed **PD-11-03**) | HP:71 runs a bare `make -C apps/capture-worker`. The full `make` also builds the sanitizer targets (`relay-asan`/`relay-fuzz`), which may fail on a bare host. The packaged build runs a named REQUIRED target set instead. Proposal: run the same named set with `PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig`, then run the `ldd` check as written. The build file names `clang` (HOST-10) | 29 | research/01_explore_capture_build.md:32, :43, :46; HP:71 |
| HOST-15 | Relay and guard built against the same library | applicable | The build outputs are `/opt/dems/core/apps/capture-worker/build/capture-relay` and `capture-guard` (reg:171-172). The same target-set note as HOST-14 applies | 30, 31 | research/01_explore_capture_build.md:48; HP:72 |
| HOST-16 | Mic helper = pinned ffmpeg, absolute root path | applicable | `DEMS_CAPTURE_AUDIO_HELPER=/opt/dems/ffmpeg-9.0.2/bin/ffmpeg` (reg:173) and a namei check. A USB mic is attached (W13), but the confirming check 9A/H-08 (shared capture on both inputs) is out of scope (one mic, no session) | 31, 42 | reg:173; SPEC:167; HP:73 |
| HOST-17 | Process listing gives full path (procps) | applicable | procps is part of the default install. The two `ps` observations are recorded. **No blueprint row names HOST-17** (rows 21-45 cover 01-16 and 18-47 without it). Recommendation for rows 18/19: record it in row 21 (preflight). 9A/H-24 is out of scope | 21 (proposed) | HP:74; 02_structured.md rows 21-45 |
| HOST-18 | iputils-arping at `/usr/bin/arping`; `/usr/sbin/ip`; dpkg records agree | applicable | `iputils-arping` is missing today. The Core asks for the arping variant at every Linux production start **whether or not the helper is installed** (HP:80), so the item is required even though the helper is absent. `python3` 3.12 is present. 9A/H-25 is out of scope (helper) | 24 | Survey:25, :155; 03_deployment_check_20261022.md:22; HP:9, :80 |
| HOST-19 | Dedicated camera port: one static /24, no gateway, no DNS, no DHCP | deviation of form (**D8 A8**); KEPT as host hygiene, wording amended (masterplan/01_specs_rflex_host_docs.md:63, E-P4; F96-1 may end A8) | Row 93: the item is kept as host hygiene and is no longer the Core's only camera path (D10 ruling 2). File B is **not** written. The existing NM profile `DEMS Camera LAN` on `enp4s0` (192.168.100.254/24, no gateway, never-default, ipv6 ignore) gives the state, and the profile's two checks are run read-only. Wi-Fi `wlp3s0` holds the only default route | 34, 70, 71 | Survey:134-142; reg:44-45, :101; 01_translated.md:97 (A8); decisions.md D8, D10, D12; 01_specs_rflex_network.md:31 |
| HOST-20 | Forwarding off (file C) | applicable; KEPT unchanged (masterplan/01_specs_rflex_host_docs.md:64, E-P5) | Row 93: kept unchanged. Under D11 it becomes the only thing that stops the host from bridging the camera port and Wi-Fi (row 89 RR-4, RG-14). The Core still refuses a start on forwarding (host-checks.ts:113). Forwarding is 0 at runtime today, and file C makes it persistent | 33, 47, 70, 71 | 03_deployment_check_20261022.md:9; 01_backup_and_docker_removal.md:25; 01_specs_rflex_security.md:144, :217; research/01_explore_rflex_network_core.md:93; HP:82 |
| HOST-21 | No forwarding software (container runtime, VM bridge, VPN) | applicable, already PASS (**D2**); KEPT unchanged (masterplan/01_specs_rflex_host_docs.md:65) | `dpkg -l` shows only `rc containerd.io`, `rc docker-ce`, and no `ii`. Leftovers that do not fail the check: the `docker` group (gid 984), `/etc/apt/sources.list.d/docker.sources`, `/var/lib/docker` and `/var/lib/containerd`, all kept on the user's rule. Nothing is reinstalled (02_structured.md:159) | 21 (re-check), 74 | 03_deployment_check_20261022.md:10; Survey:104, :115; 01_backup_and_docker_removal.md:24; HP:83 |
| HOST-22 | ufw on, deny incoming and routed | applicable (with **D5**, **D8 A9**); KEPT unchanged (masterplan/01_specs_rflex_host_docs.md:66) | ufw is installed but `Status: inactive` (ENABLED=no). SSH allow on `wlp3s0` goes first, with auto-revert armed, then enable on the user's yes (HIL). AC7 is unchanged (U-RF3) | 36 | Survey:24, :121-122; reg:139; decisions.md D5, D12; HP:84 |
| HOST-23 | Admit search answers (UDP source port 3702) on the camera port | applicable, **camera port only (D12 U-RF3)**; KEPT, wording amended (masterplan/01_specs_rflex_host_docs.md:67, E-P7..E-P7c) | The rule is `ufw allow in on enp4s0 proto udp from any port 3702`. Stated consequence of D10 global discovery: multicast answers on Wi-Fi or another port are dropped by HOST-22, so devices there are reached by typed address only (typed-probe reply admitted by conntrack: **hypothesis**, 9A/H-12) | 36, 72 | masterplan/01_specs_rflex_host_docs.md:67, :156 (check: exactly one 3702 rule, `on enp4s0`); reg:140; 01_specs_rflex_security.md:196-205; 01_specs_rflex_network.md:63, :164-167; HP:85 |
| HOST-24 | Core services not reachable on the camera port | applicable (check extended, proposed **PD-11-04**); KEPT, wording amended to 'any network of the host' (masterplan/01_specs_rflex_host_docs.md:68, E-P8; 5173 left to row 14) | The Core listens on `127.0.0.1:4420` (constant), and the DB on `127.0.0.1:4432` (W2). The console listens on `127.0.0.1:5173` (W4). HP:86's check names only ports 4420-4423. Proposal: add 4432 and 5173 to the "no ALLOW" and "127.0.0.1 only" readings, since they are new listeners of this install | 59, 72 | reg:133-138; SPEC:130, :304; HP:86 |
| HOST-25 | Loopback rule for 8554-8564 (files D, E, nftables) | applicable | nftables 1.0.9 is present and the ruleset is empty. File D gets `skuid != "dems-core"`. The unit is enabled before file G starts | 35 | masterplan/01_specs_rflex_host_docs.md:69 (KEPT unchanged); Survey:26, :126-128; reg:98, :111; SPEC:194-195; HP:87 |
| HOST-26 | alsa-utils, `/usr/bin/arecord -l`, service user in `audio` | applicable (**W13**) | alsa-utils 1.2.9 is present, and `/usr/bin/arecord` exists. The `audio` group (gid 29) is empty. The step is `usermod -aG audio dems-core`. With the mic connected, `arecord -l` as `dems-core` must list `card 1: AUDIO [BOMGE USB AUDIO]`. ALC897 now enumerates as card 2. Card numbers shift with USB enumeration (D3 of 03_), so the check must match the card **name**, not the number | 37 | Survey:26, :100, :104, :164-169; 03_deployment_check_20261022.md:20-21 (D2, D3); reg:65; HP:93 |
| HOST-27 | The audio interface is USB Audio Class | applicable (**W13**), partial | `/proc/asound/cards` shows `1 [AUDIO] USB-Audio - BOMGE USB AUDIO, "HANMUS BOMGE USB AUDIO at usb-0000:01:00.0-1"`, so the driver is `USB-Audio`. Expected PASS for `lsusb` and `cards`. It differs from UA-2 in two ways. (a) There is one mic, not a two-input interface with two mics (U-RF5 keeps the second mic out). (b) It has **no USB serial**, which is the case R-FLEX D10 ruling 1 changes. 9A/H-07 (identity after re-plug) is out of scope as a named check. Its facts are partly observed by R-FLEX rows 125-127 | 37, 125-127 | Survey:168; 03_deployment_check_20261022.md:20 (D2); 02_structured.md:129 (W13), :64; HP:94 |
| HOST-28 | No sound server holds the interface | applicable (**W13**), check scoped (proposed **PD-11-05**) | .73 is a desktop install: snap is in use, and a `/run/user/1000/doc` portal mount points to a user session. The sound-server state was **not surveyed** (gap). HP:95's check `fuser -v /dev/snd/pcmC*D*c` covers every card, including ALC897 (card 2, `pcmC2D0c`, `pcmC2D2c`), which is not a DEMS input. Proposal: run the check with no session logged in, read the result per card, and pass on the USB card (`pcmC1D0c`, resolved through `/dev/snd/by-id` because of the card shift). A holder of card 2 is recorded, not failed. 9A/H-08 is out of scope | 37 | Survey:66, :71, :170; 03_deployment_check_20261022.md:21; HP:95 |
| HOST-29 | Never sleeps or hibernates | applicable, already PASS | The 4 targets are masked (since 10-20). `suspend-then-hibernate.target` is `static` and not in the item's list | 38 (re-check) | Survey:49-55; 03_deployment_check_20261022.md:23; HP:101 |
| HOST-30 | Lid closing does nothing (file F) | **N/A** | No lid: `upower` reports `lid-is-present: no`, and `/proc/acpi/button/` is absent (desktop board A520I-AC). File F is not written (reg:102; SPEC:196). The item itself reads "only if the host has a lid" | - | Survey:18, :40-41, :55; HP:102 |
| HOST-31 | Clock synchronised | applicable, already PASS | `System clock synchronized: yes` (systemd-timesyncd, ntp.ubuntu.com stratum 2) over the Wi-Fi uplink. D5 keeps Wi-Fi up, which removes the PREP-08 no-restart rule (F2) | 38 | Survey:22, :84-91; 02_structured.md:73 (F2); HP:103 |
| HOST-32 | Core starts only after time sync | applicable | `systemd-time-wait-sync` is **disabled** today, so row 38 enables it. File G holds `After=time-sync.target` (SPEC:93). Risk for row 16: a Wi-Fi outage at boot means no time source, so the Core does not start (02_ host file) | 38, 43 | Survey:89-91; SPEC:93; 02_host_wifi_outage_20261022.md:23-29; HP:104 |
| HOST-33 | Unit file G, root 0644 | deviation (**D8 OI-5**, proposed **PD-11-06**) | File G is settled from code (SPEC §4.1). Against HP:238-261 it adds `postgresql@18-main.service` in `After=`/`Wants=` (HOST-56), `Type=simple`, `WorkingDirectory=/opt/dems/core/apps/core-server`, `ExecStart=/opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/tsx/dist/cli.mjs src/index.ts` and `KillMode=mixed`. The checks (verify, stat) run as written. The form is confirmed at row 58 | 43, 58 | SPEC:84-117, :324 (F-S2); reg:110; HP:110, :236 |
| HOST-34 | Env file `/etc/dems/core.env` root:service-group 0640 | deviation (**W1**, SPEC **F-S5**; proposed **PD-11-07**) | HP:111 puts "the database settings" in core.env. The code reads them only from `/opt/dems/core/.data/pg.env` (five `DEMS_PG_*` keys). core.env holds none, and `DEMS_PG_*` and `PG*` must be absent. Other key differences: `DEMS_MEDIA_DIR` is set to the code default (absolute). `DEMS_INSTALLATION_NAME` is added in the REAL form. `DEMS_CAPTURE_ALIAS_SOCKET` is absent (helper absent). Mode checks and the grep for development switches run as written | 42, 57 | reg:95-97, :164-184; SPEC:154-186, :327; research/01_explore_database_commands.md:61; HP:111 |
| HOST-35 | `LimitCORE=0` | applicable (check form, see PD-11-08) | It is in file G. The `/proc/<core-pid>` reading must run on both the tsx parent (`MainPID`) and the Core child (SPEC §4.5) | 59 | SPEC:107, :146-148; HP:112 |
| HOST-36 | No diagnostic, heap or debugger switch; no `NODE_OPTIONS` | applicable (check form, proposed **PD-11-08**) | `NODE_OPTIONS` must be absent, even empty. The Core child's `cmdline` carries tsx's `--require .../preflight.cjs --import .../loader.mjs`. These pass the profile's prefixes (`--report`, `--diagnostic`, `--heap`, `--inspect`) by regex. **Hypothesis** until row 58. PD-11-08: run the `/proc` checks of HOST-35/36/38/39/40/42 on both pids | 58, 59 | SPEC:128-129, :148, :244; HP:113 |
| HOST-37 | Crash collector takes no memory image | applicable | Uses file C's core lines plus `systemctl disable --now apport.service`. The apport state on .73 was **not surveyed** (gap; Ubuntu desktop usually ships it, which is a hypothesis). Row 33 records it | 33 | SPEC:193; reg:100; HP:114 |
| HOST-38 | `NoNewPrivileges=yes` | applicable | In file G. 9A/H-06 (helper) is out of scope, so "the helper still works from this unit" is not run | 43, 59 | SPEC:108; HP:115 |
| HOST-39 | Empty capability bounding set, no ambient caps | applicable (partial) | In file G and checked via `/proc`. The confirmation 9A/H-17 (a session records with this in force) is out of scope (no session) | 43, 59 | SPEC:109-110; HP:116 |
| HOST-40 | Supplementary groups exactly `audio dems-netalias` | applicable | `SupplementaryGroups=audio dems-netalias`. The helper group must exist even without the helper, or the unit does not start (HOST-43). 9A/H-05 is out of scope | 43, 59 | reg:67; SPEC:101; research/01_explore_helper_absence.md:19; HP:117 |
| HOST-41 | Core requires the loopback rule | applicable | `Requires=` and `After=dems-loopback-rule.service` in file G. The stop-then-both-stopped check is run once | 43 | SPEC:93-95; HP:118 |
| HOST-42 | `UMask=0077` | applicable | In file G | 43, 59 | SPEC:106; HP:119 |
| HOST-43 | Helper group whose only member is the service user | applicable (the exception of HP §3.8) | `groupadd --system dems-netalias`, `usermod -aG dems-netalias dems-core`. Nothing else of the helper is installed. The group name is fixed by code (`host-checks.ts:200`) | 23 | reg:40, :66; research/01_explore_helper_absence.md:10-19; HP:125, :129 |
| HOST-44 | Helper socket unit and template service unit | **N/A** (absence verified instead) | The helper is out of scope (01_translated.md:45; A7 in D8). The rule is all or none, so the state required instead is the **absence** of `/run/dems-core-netalias/socket`, `/run/dems-core-netalias`, `/etc/systemd/system/dems-core-netalias.socket` and `dems-core-netalias@.service`. Any one present refuses the start (`CAPTURE_HOST_ALIAS_SOCKET`) | 45 (80-helper-state.sh) | research/01_explore_helper_absence.md:22-34, :47-49; reg:116; HP:125, :130 |
| HOST-45 | Helper file root 0755, hash matches | **N/A** (absence verified instead) | Same reason as HOST-44. The required state is no `/usr/local/sbin/dems-core-netalias` | 45 | research/01_explore_helper_absence.md:28; HP:131 |
| HOST-46 | Interface file `/etc/dems/netalias-interface` | **N/A** (helper absent); KEPT, wording amended (masterplan/01_specs_rflex_host_docs.md:70, E-P10; bench N/A per masterplan/01_specs_rflex_host_docs.md:158) | Row 93 (I7): the file is not written (reg:103). With the helper absent the Core does not ask (`NOT_ASKED`), and a null stored `capture_network_config.interface_name` is also `NOT_ASKED` (program-checks.ts:285-294, :331-342). R-FLEX leaves the HOST-46 behaviour unchanged under N-96-1 = bound (row 90). Row 45 records the outcome "as amended" once row 93 lands | 45 | research/01_explore_helper_absence.md:33; 01_specs_rflex_network.md:53, :65, :173; 01_specs_rflex_security.md:193; HP:132 |
| HOST-47 | No sudoers line names the helper | applicable | It applies without the helper (nothing is written). `/etc/sudoers.d` holds `90-gsp-dems` and `README`. Expected `0` per file (contents not read; **hypothesis** from `sudo -l`) | 45 | Survey:175-176; HP:133 |
| HOST-48 | Camera page opened from a browser on the host or on a camera-switch laptop | deviation (**D8 F7**), partial | The pages are opened from the Mac browser through SSH local forwards via .73 (`-L 181xx:192.168.100.x:80`), and IP forwarding stays 0. The four cameras already sit on 192.168.100.101/.102/.103/.117, so the "factory-address scan" half is out of scope (helper absent, 9A/H-13 out) | 62-65 | reg:147; decisions.md D8 (F7); 03_deployment_check_20261022.md:23; HP:139 |
| HOST-49 | Start names no missing prerequisite | applicable (partial) | Read at the first REAL boot (journal). The half "one prerequisite removed on purpose names exactly that one" is 9A/H-04, which is out of scope (no development Core, PREP-06 out) | 58 | HP:140; 02_structured.md:478 |
| HOST-50 | PostgreSQL source (open choice A/B/C) | applicable, choice **B (D8 A3)** | PGDG noble, major 18, packages `postgresql-18` and `postgresql-client-18`. The key fingerprint is confirmed with gpg on the host | 39 | reg:230-233; research/02_collection_pgdg.md:24-56; decisions.md D8 |
| HOST-51 | Server version 18.4 tested | applicable (pending **D12 U-RF10**) | The minor (18.4 tested, or 18.6 current) is fixed by row 13 (masterplan/01_specs_database.md). If 18.6 is chosen, record it as a deviation from "18.4 only" | 39 | reg:231; research/02_collection_pgdg.md:51, :56; HP:149 |
| HOST-52 | Server data dir owner 0700, not inside the install dir | applicable | `/var/lib/postgresql/18/main` (**hypothesis**, package default). It is not under `/opt/dems/core` | 40 | reg:234; HP:150 |
| HOST-53 | Server listens on 127.0.0.1 only | deviation (**W2**, proposed **PD-11-09**) | The port is **4432**. 5432 is refused by code (`FOREIGN_DATABASE_PORT`). `listen_addresses = '127.0.0.1'`. Whether the local socket is kept is decided by row 13 | 40 | reg:137, :149-158; research/01_explore_database_commands.md:29; HP:151 |
| HOST-54 | Owner role and runtime role; settings through core.env | deviation (**W1/W3**, **D8 OI-4**, proposed **PD-11-07**) | The roles are `dems_owner` and `dems_app`. Runtime settings are in `.data/pg.env` (not core.env), and owner settings are in `.data/pg.owner.env` (W3, provisioning by row 13). Secrets are generated by the agent straight into these files and never printed (OI-4 option B, instead of "set by the user"). **DB-05 of 95-database.sh:73-78 carries the same core.env statement and the same deviation** | 41 | reg:95-96, :241-242; research/01_explore_database_commands.md:57, :61; HP:152 |
| HOST-55 | Database `dems_demo` created, migrated, seeded | applicable | The name is in the closed list. The commands run as `dems-core` because `pg.owner.env` lies in the 0700 data dir (invocation form by rows 13 and 15). Migrations include the R-FLEX pair (row 98) | 44 | reg:240; research/01_explore_database_commands.md:27-32; HP:153 |
| HOST-56 | Core starts after the DB server | applicable | `After=`/`Wants=postgresql@18-main.service` in file G (the unit name is a **hypothesis**, confirmed at row 39). It is proved by the final reboot (Core active without a manual start) | 43, 71 | SPEC:93-94; reg:113; HP:154 |

**Count (by the status cell, 56 lines, no overlap):**
- applicable: 36 (01, 02, 03, 10, 11, 12, 13, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 28, 29, 31, 32, 35, 36, 37, 38, 40, 41, 42, 43, 47, 50, 51, 52, 55, 56). Four of them (20-23) carry the row-93 verdict KEPT. Four (24, 28, 35, 36) carry a proposed check-form change (PD-11-04, -05, -08).
- applicable (partial): 5 (07, 08, 27, 39, 49).
- deviation: 11 (04, 05, 06, 09, 14, 19, 33, 34, 48, 53, 54). HOST-19 is a deviation of form only (A8).
- N/A: 4 (30, 44, 45, plus 46). Each one has a reason.

## W1 in one place (data dir fixed at `<install>/.data`)

| Profile text | Code fact | Effect | Items |
|---|---|---|---|
| `<data-dir>` is the user's choice, "on a disk of its own if possible" (HP:36) | `loadConfig` gets no data dir, so `DEFAULT_DATA_DIR` = `<install>/.data` (src/index.ts:58; load-config.ts:53-60) | `/opt/dems/core/.data`, on the one ext4 disk | HOST-06, HOST-07 |
| HOST-05: tree not writable by the service user | `.data` lies inside the tree | One writable hole in the root tree (plus `logs`, `.vite`) | HOST-05 |
| HOST-04: home = `<data-dir>` | Tool caches would land in the evidence store | F-S1 proposes `/nonexistent` | HOST-04 |
| HOST-34 and DB-05: DB settings in core.env | Only `<data>/pg.env` is read; `PG*` are deleted | No DB key in core.env | HOST-34, HOST-54 |
| Removal (HP:297): `<data-dir>` is never removed by the profile | A reinstall that deletes `/opt/dems/core` deletes the evidence store | Row 16 backup scope and row 26 copy rule (no delete of extra entries) | rows 16, 26 |

## W13 mic facts used for HOST-26..28

| Fact | Value | Source |
|---|---|---|
| USB mic | HANMUS "BOMGE USB AUDIO", USB id 3347:2430, port 1-1, **no USB serial** | 03_deployment_check_20261022.md:20 (D2) |
| ALSA card | `card 1: AUDIO`, capture node `pcmC1D0c`, driver `USB-Audio` | Survey:165-169 |
| Onboard codec | ALC897, now `card 2: Generic_1` (`pcmC2D0c`, `pcmC2D2c`). It was card 1 on 10-21 | 03_deployment_check_20261022.md:21 (D3); Survey:166-169 |
| HDMI | card 0, no capture | Survey:168 |
| `audio` group | gid 29, no members | Survey:100, :104 |
| Count | one mic. The 4-slot session needs two (U-RF5: out) | 02_structured.md:64; decisions.md D12 |

## Wi-Fi fix files (host state, not profile items)

These files are present host state from F1-F3 (02_host_wifi_outage_20261022.md:55-62). No HOST item covers them, and nothing in this matrix changes them.

| File | Effect on the matrix |
|---|---|
| `/etc/NetworkManager/conf.d/zz-dems-wifi-powersave-off.conf` | None. It does not touch `enp4s0` (HOST-19) |
| `/etc/modprobe.d/rtw88-dems.conf` | None |
| `/usr/local/sbin/dems-wifi-watchdog`, `/etc/systemd/system/dems-wifi-watchdog.{service,timer}` | Not matched by the HOST-02 patterns. The `/usr/local/sbin` path is the same directory as the helper path (HOST-45), but the helper-absence check looks for the exact file `dems-core-netalias` only, so it is not affected (research/01_explore_helper_absence.md:28). The watchdog can **reboot** after 15 min without the gateway, which interacts with HOST-31/32 and a recording. Row 123 creates `/etc/dems-wifi-watchdog.noreboot` (U-RF7, reg:104) |

## PREP and 9A/H scope

Scope statement from the blueprint: "Not run: PREP-05, PREP-06, 9A/H-02..08/24/25 and 17 onward, 9A/H-01 .9/.11, steps 7a, 9, 11, 12, unless U-RF5 brings steps 11-12 back" (02_structured.md:478). Read against HW-ACCEPTANCE-1-FRAME.md:236-335 and the check headings of chapters 2 and 3:

| Item | Scope | Reason / bench form | Rows |
|---|---|---|---|
| PREP-01 | in (adapted) | The tree is not a commit. It is recorded per OI-7 with the R-FLEX diff hash (row 121). UA-6 holds: no legacy data moved, Docker DB not restored | 26, 121 |
| PREP-02 | out | B-1..B-7 serve the session checks (9A/H-08/11/18/19) and PREP-13 rule 4 of B-5 (9A/H-23). None of them runs | - |
| PREP-03 | in (adapted) | Devices: 4 cameras and 1 mic (not 2 mics, U-RF5). Room network: neither way A nor way B applies. Wi-Fi stays up throughout (D5) | 21 |
| PREP-04 | in | PGDG server 18 on `127.0.0.1:4432`. Step 2 "as HOST-34 states" is replaced by `pg.env` (HOST-34 deviation) | 39-41 |
| PREP-05 | out | No throw-away database (no development Core) | - |
| PREP-06 | out | No pusher with an H.264/H.265 encoder on the host (frame open point 11) | - |
| PREP-07 | in (with D3) | The frame says "no agent performs this step". D3 lets the agent perform host steps on the user's word | 44 |
| PREP-08 | in (adapted) | SIMULATED boot through `dems-core.service`. Step 1 (cable out, no restart) does not apply because of D5/F2. Step 3 (browser on the host) is replaced by the SSH forward (OI-2) | 48, 49 |
| PREP-09 | in (adapted) | Passwords typed over `ssh -t` by the user (D6, OI-1). CLI form per SPEC §7.2 | 50-55 |
| PREP-10 | in | Run as `dems-core` (W5), id `DEMS-BENCH-01`, organisation typed by the user (OI-3) | 56, 57 |
| PREP-11 | N/A | The host is never off the room network (D5). Step 2 (`ss` listeners) is covered by HOST-24 in row 59 | - |
| PREP-12 | in (step 2-3 only) | Step 1 (review statement) is out because the helper is not installed. Steps 2-3 are the group (HOST-43) and the known NOT_PRESENT outcome | 23, 58 |
| PREP-13 | in (adapted) | Per camera: password and clock, with pages through SSH forwards (F7). B-5 rule 4 (special characters, 9A/H-23) is not required | 62-65 |
| PREP-14 | out | Four slots need two mics (U-RF5). R-FLEX binding rows 125-127 do not assign a 4-slot session | - |
| 9A/H-01 | in, except steps .9 and .11 | The host profile applied (this matrix is its item list). Steps .9 and .11 need a pusher | 46 |
| 9A/H-02, -03, -04, -24 | out | They need a development-capture Core (PREP-06). HOST-07 sync level and HOST-49's removal half fall with them | - |
| 9A/H-05, -06, -25 | out | Helper not installed (A7) | - |
| 9A/H-07 | out as a named check | Its subject (listing, identity after re-plug) is now partly observed by R-FLEX rows 37, 125-127 on the one mic. See R96-11-02 | (37, 125-127) |
| 9A/H-08 | out | Shared capture on two inputs needs the interface of UA-2 and a session | - |
| 9A/H-09, -11, -17..-22, -26 | out | Session-based (S1-S4) | - |
| 9A/H-10 | in | Connect flow per camera | 66-69 |
| 9A/H-12 | in (implicitly, not named) | The global search of rows 66-69 runs steps .1-.2. Steps .3-.4 (typed address) depend on the R-FLEX network config (row 124). The blueprint row does not name 9A/H-12. See R96-11-03 | 36, 66-69, 124 |
| 9A/H-13, -14, -15 | out | Commissioning functions answer `409 COMMISSIONING_NOT_AVAILABLE` without the helper | - |
| 9A/H-16 | in | First REAL_PRODUCTION start, unassigned selector | 58, 60 |
| 9A/H-23 | out | Line 478 "17 onward". It needs a camera account with the B-5 special-character password | - |
| 9A/H-27 | out as a named check; its HOST-02 lines run | Line 478 "17 onward". HOST-02 measures the same state in row 21 | 21 |

## Key Findings

### Finding 1 [Confidence: HIGH] W1 makes four items deviations and closes one profile option
- Description: the fixed data dir puts the evidence store inside the root-owned tree on the system disk and moves the DB settings out of core.env.
- Evidence: research/01_explore_core_runtime.md:34; research/01_explore_database_commands.md:61; SPEC:50-73.
- Implication: HOST-04/05/06/34/54 and DB-05 carry deviations. Row 26 must not delete or re-own `.data`.

### Finding 2 [Confidence: HIGH] No blueprint row applies HOST-17
- Description: the install rows 21-45 name every item except HOST-17.
- Evidence: 02_structured.md:189-213.
- Implication: rows 18 and 19 add it to row 21 (two `ps` observations). The change is MINOR.

### Finding 3 [Confidence: HIGH] HOST-18 and HOST-20 are required even with the helper absent and the camera lock lifted
- Description: the Core asks for the arping variant and refuses on forwarding at every Linux production start.
- Evidence: HP:9, :80; research/01_explore_rflex_network_core.md:93 (host-checks.ts:113).
- Implication: neither may be read as "helper-only" or "R-FLEX-lifted".

### Finding 4 [Confidence: MEDIUM] HOST-28 cannot pass as written on a desktop host with an onboard codec
- Description: the check covers every capture node, including ALC897 (card 2), which a desktop sound server may hold. The sound-server state was not surveyed.
- Evidence: Survey:66, :166-170; HP:95.
- Implication: PD-11-05 scopes the check to the USB card by id. Row 37 reads the sound-server state first.

### Finding 5 [Confidence: MEDIUM] Several checks assume one Core pid
- Description: the ExecStart form gives a tsx parent and a Core child.
- Evidence: SPEC:146-148.
- Implication: PD-11-08 applies to rows 58 and 59.

## Files and Modules Involved
- scripts/host/HOST-PROFILE-UBUNTU-24.04.md: the 56 items (read-only authority).
- scripts/host/95-database.sh:73-78: DB-05 (same core.env deviation as HOST-54).
- scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md:236-335, -2-HOST-HELPER-AUDIO.md, -3-NETWORK-CAMERAS-SESSION.md: PREP and 9A/H scope.
- masterplan/01_specs_register.md, masterplan/01_specs_service.md: names and file G.
- masterplan/01_specs_rflex_host_docs.md (row 93): verdicts for HOST-19..25/46. Profile wording is applied by row 113.

## Implementation Order
Unchanged from the blueprint. The only additions are HOST-17 in row 21, and the PD-11-05 and PD-11-08 check forms in rows 37, 58 and 59.

## Risks
- HOST-32 with Wi-Fi as the only time source: an outage at boot keeps the Core down. Mitigation: row 16 states it. The watchdog flag (row 123) prevents a reboot loop. No new mitigation is proposed here.
- Row 96 answers F96-1 (network-manager equivalent in HOST-19) or Q-R4 (helper bound) differently: HOST-19 loses or keeps its A8 mark, and HOST-46 needs a new reason. Row 95 re-checks both lines.
- Card renumbering (W13 D3) breaks a number-based check. Mitigation: check by card name or `/dev/snd/by-id`.

## Acceptance Criteria (of this row)
1. 56 HOST lines in the matrix: met (HOST-01..HOST-56, one line each).
2. Every N/A has a reason: HOST-30, -44, -45, -46 (default), PREP-11. Met.
3. HOST-19..23/46 cite row 93: met (masterplan/01_specs_rflex_host_docs.md:63-70; HOST-24 and HOST-25 cited too).

## Recommendations
1. The controller records PD-11-01..09 as proposed deviations. PD-11-02/07 (W1) and PD-11-09 (W2) are code-forced and need only recording. PD-11-03/04/05/08 are check-form changes for row 18. F-S1 goes to row 96.
2. Rows 18/19 add HOST-17 to row 21.
3. Row 37 first reads the sound-server state (`systemctl --user` of uid 1000, `fuser` per card) before HOST-28.

## Placeholders for row 95

None left. The six `<DEP:row93:HOST-nn>` placeholders of the first draft (HOST-19..23, HOST-46) were resolved against masterplan/01_specs_rflex_host_docs.md lines 63-70 after it landed (16:51). Each draft default equalled the row-93 verdict. Two row-93 questions still touch this matrix: F96-1 (HOST-19, A8) and Q-R4 (HOST-46). Both are open at row 96.

## For row 96

| Id | Question | Options | Recommendation |
|---|---|---|---|
| R96-11-01 | Service-account home (= SPEC F-S1, register conflict) | (a) `/nonexistent`; (b) `/opt/dems/core/.data` as HOST-04 | (a), as SPEC recommends |
| R96-11-02 | Run 9A/H-07 (card listing, identity after re-plug) now that one mic exists | (a) keep it out and let rows 125-127 observe; (b) add it as a named check on the one mic | (a): rows 125-127 already exercise re-plug under the R-FLEX identity rule, and 9A/H-07 was written for the old port-lock identity |
| R96-11-03 | Name 9A/H-12 in rows 66-69 | (a) name it (steps .1-.2, plus .3-.4 after row 124); (b) leave it implicit | (a): it is the only check that tests HOST-23 against a real camera |
| R96-11-04 | HOST-28 check scope (PD-11-05) | (a) USB card only, by id; (b) all cards as written (may fail on ALC897) | (a) |

---
*Generated: 2026-10-22 17:05*
*Last Updated: 2026-10-22 17:15*
