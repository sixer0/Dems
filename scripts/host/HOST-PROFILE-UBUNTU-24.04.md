# DEMS Core: Linux host profile for Ubuntu 24.04

**Status of this document: UNVERIFIED on Ubuntu.** It was written on a development Mac with no Linux host available. No command below has been run on Ubuntu 24.04, and nothing here has been applied to any machine. Every command and every expected output is a statement of intent until the hardware acceptance package (checks `9A/H-01` to `9A/H-27`) has run on the real host. An item the author is unsure of carries "to confirm in 9A/H-nn" in its last column; an item without that mark is still unverified, it is only not doubted.

This document installs nothing by itself. It is a list to be applied by a person.

## 1. Purpose, reader, scope

| | |
|---|---|
| What | The state a Ubuntu 24.04 machine must be in before a DEMS Core records from real cameras and a USB audio interface on it: one line per item, with the command or file that produces the state and the check that shows it took effect |
| Reader | The installer who prepares the host, and the person who runs check `9A/H-01` of the hardware acceptance package ("apply the profile line by line; run each took-effect check") |
| Who performs the steps | The user, on the host, with administrator rights. No step is performed by an agent or by the Core. Commands that start with `sudo` are the user's |
| Why Ubuntu 24.04 | The audio scheme that was tested (a USB Audio Class interface through ALSA shared capture) exists on Linux only; the production host was ruled as Linux, Ubuntu 24.04 |
| In scope | Build prerequisites and the pinned media library, the camera port, the firewall, the loopback rule, directories, audio access, sleep, time, the Core's service unit, the installed state of the address helper |
| Not in scope | See section 5: the database, the signing key, the operators, the steps of the helper installation, the camera's own settings |

## 2. How to read an item

- **Id** is stable (`HOST-nn`). The profile's scripts and the Core's boot checks refer to it.
- **Command or file** is what the user runs or writes. Longer files are printed once in section 4 and referred to by letter (file A to file G).
- **Check** is a command with the output that shows the item took effect. An item passes only when the check prints what is stated.
- **Confirm** names the hardware check that settles a doubt. "-" means no specific doubt beyond the general status above.

Placeholders, chosen by the user on the host and never written into this document:

| Placeholder | Meaning |
|---|---|
| `<service-user>` | The account the Core runs as. Proposal: `dems-core`. It must not be the account of an earlier input-av installation |
| `<helper-group>` | The dedicated group of the address helper's socket. Its name is fixed by the helper's delivery |
| `<install-dir>` | Where the product tree lies. Proposal: `/opt/dems/core`. Owned by root |
| `<data-dir>` | The Core's data directory, owned by `<service-user>`. On a disk of its own if possible |
| `<ffmpeg-prefix>` | Where the pinned FFmpeg is installed. Proposal: `/opt/dems/ffmpeg-9.0.2`. Owned by root |
| `<camera-interface>` | The network port that carries only the cameras |
| `<camera-address>` | The host's private address on the camera port, with a `/24` prefix |
| `<core-pid>` | The process id of the running Core: `systemctl show dems-core.service -p MainPID --value` |

## 3. The items

### 3.1 Before anything is installed

| Id | Item | Command or file | Check that shows it took effect | Confirm |
|---|---|---|---|---|
| HOST-01 | The host runs Ubuntu 24.04 LTS | none (a fresh installation) | `lsb_release -ds` prints a line that starts with `Ubuntu 24.04`; `uname -m` is recorded | to confirm in 9A/H-01 (the processor architecture is not ruled in any design document) |
| HOST-02 | No input-av installation is on the host: no service, no helper, no sudoers line, no generated ALSA configuration | none; if one is found, removing it is the user's action before the profile is applied | `systemctl list-unit-files 'dems-nvr*' 'dems-mediamtx*'` ends with `0 unit files listed.`; `ls /usr/local/sbin/dems-netalias /etc/sudoers.d/dems-netalias` prints `No such file or directory` twice (run with `sudo`) | to confirm in 9A/H-27 (where input-av wrote its ALSA configuration is named there) |
| HOST-03 | The host has no interactive account besides its one administrator | none; other accounts are removed or locked by the user | `awk -F: '$7 !~ /nologin$/ && $7 !~ /false$/ {print $1}' /etc/passwd` prints `root`, `sync` and the one administrator account, nothing else | to confirm in 9A/H-01 |

### 3.2 Service user and directories

| Id | Item | Command or file | Check that shows it took effect | Confirm |
|---|---|---|---|---|
| HOST-04 | A system account for the Core, without a login shell | `sudo useradd --system --home-dir <data-dir> --shell /usr/sbin/nologin <service-user>` | `getent passwd <service-user>` prints one line that ends with `/usr/sbin/nologin` | - |
| HOST-05 | The product tree belongs to root and is not writable by the service user, so that the worker, the relay and the helper programs pass the Core's "private executable" rule | `sudo install -d -o root -g root -m 0755 <install-dir>`, then the tree is copied there as root | `namei -l <install-dir>/apps/capture-worker/build/capture-worker` prints, for every component, owner `root` and no `w` for group or others | to confirm in 9A/H-01 |
| HOST-06 | The data directory and the media store belong to the service user and are owner-only | `sudo install -d -o <service-user> -g <service-user> -m 0700 <data-dir> <data-dir>/media <data-dir>/media/sessions` | `sudo stat -c '%U %G %a' <data-dir> <data-dir>/media/sessions` prints `<service-user> <service-user> 700` twice; a real-capture Core that starts does not report `CAPTURE_EVIDENCE_STORE_UNUSABLE` | - |
| HOST-07 | The evidence volume supports hard links, exclusive file creation and a durable sync | a local Linux file system for `<data-dir>` (not a network share, not a FAT or exFAT volume) | `findmnt -no FSTYPE,SOURCE --target <data-dir>/media/sessions` names the file system; the Core's start does not report the reasons `NO_HARD_LINKS` or `NO_SYNC` | to confirm in 9A/H-03 (the sync level the worker states on this disk; see section 5, line 1) |
| HOST-08 | The run directory is mode 0700 and every microphone pipe in it is mode 0600 | the Core creates `<data-dir>/run/capture` itself; the user provides HOST-06 and `UMask=0077` in the unit (file G) | during a running session: `sudo find <data-dir>/run -type d ! -perm 700` prints nothing; `sudo find <data-dir>/run -type p ! -perm 600` prints nothing; `sudo find <data-dir>/run -type p` prints at least 1 path | to confirm in 9A/H-01 |

### 3.3 Runtime, the pinned media library, the capture programs

| Id | Item | Command or file | Check that shows it took effect | Confirm |
|---|---|---|---|---|
| HOST-09 | Node.js 26.8.2, the version the repository pins (`.node-version`), installed under a root-owned path | the official Linux binary archive of that version, unpacked as root; its checksum compared with the publisher's list by the user | `node --version` prints `v26.8.2`; `namei -l "$(command -v node)"` shows owner `root` on every component | to confirm in 9A/H-01 (installation method) |
| HOST-10 | Build tools | `sudo apt-get install -y build-essential clang make pkg-config python3 nasm libasound2-dev` | `dpkg -s clang make pkg-config python3 nasm libasound2-dev` prints `Status: install ok installed` 6 times | to confirm in 9A/H-01 (package names on 24.04) |
| HOST-11 | The distribution's FFmpeg development packages are absent, so that the build cannot pick another libavformat | none; if present: `sudo apt-get remove libavformat-dev libavcodec-dev libavfilter-dev libswresample-dev libavutil-dev` | `dpkg -s libavformat-dev` prints `is not installed` | to confirm in 9A/H-01 (hypothesis: Ubuntu 24.04 packages FFmpeg 6.1, which the worker refuses at build and at start) |
| HOST-12 | FFmpeg 9.0.2 (libavformat 63.1.102) built from the release source, with the ALSA input, as shared libraries, into `<ffmpeg-prefix>` | in the unpacked release source, after the user has compared the archive's checksum with the publisher's: `./configure --prefix=<ffmpeg-prefix> --enable-shared --disable-static --disable-doc --enable-indev=alsa`, then `make -j"$(nproc)"`, then `sudo make install` | `<ffmpeg-prefix>/bin/ffmpeg -hide_banner -version` names `9.0.2` in its first line and `libavformat 63.  1.102` below; `<ffmpeg-prefix>/bin/ffmpeg -hide_banner -devices` prints a line that holds `alsa` with the demuxing mark `D` | to confirm in 9A/H-01 (the configure line; whether this feature set is the one the capture series was verified on; the licence of the build is the user's open decision) |
| HOST-13 | The dynamic loader finds the pinned libraries | file A, then `sudo ldconfig` | `ldconfig -p` lists `libavformat.so.63` with a path under `<ffmpeg-prefix>/lib` | to confirm in 9A/H-01 |
| HOST-14 | The capture worker built against the pinned library, with its own checks | from `<install-dir>`, as root: `PKG_CONFIG_PATH=<ffmpeg-prefix>/lib/pkgconfig make -C apps/capture-worker` | the command exits 0 (static rules, their self-test, unit checks, the import check of the binary); `ldd apps/capture-worker/build/capture-worker` resolves `libavformat.so.63` under `<ffmpeg-prefix>/lib`; the Core's start does not report `CAPTURE_WORKER_MEDIA_LIBRARY_MISMATCH` or `CAPTURE_WORKER_PROGRAM_UNUSABLE` | to confirm in 9A/H-01 (the build file names `clang`; the import list was fixed on macOS and may differ on glibc) |
| HOST-15 | The camera relay and the guard program built against the same library | their build commands are named by the product tree beside each program | each program states the library version of HOST-12; the Core's start names no version difference between the relay and the worker | to confirm in 9A/H-01 |
| HOST-16 | The microphone helper is the pinned FFmpeg program, reached by an absolute root-owned path | none beyond HOST-12; the Core's configuration names `<ffmpeg-prefix>/bin/ffmpeg` | `namei -l <ffmpeg-prefix>/bin/ffmpeg` shows owner `root` and no `w` for group or others on every component | to confirm in 9A/H-08 (the configuration key that names the program for the ALSA input) |
| HOST-17 | The process listing gives the full program path to the Core's leftover check | `procps` (part of a default installation) | `ps -axo pid=,comm=` prints short names (at most 15 characters) and `ps -axo pid=,args=` prints full paths; both observations are recorded | to confirm in 9A/H-24 |

### 3.4 The camera port, the firewall, the loopback rule

| Id | Item | Command or file | Check that shows it took effect | Confirm |
|---|---|---|---|---|
| HOST-18 | The conflict-check tool is the iputils one; the other package named `arping` is absent | `sudo apt-get install -y iputils-arping iproute2` | `dpkg -S "$(command -v arping)"` prints `iputils-arping: /usr/bin/arping`; `dpkg -s arping` prints `is not installed` | to confirm in 9A/H-25 (the two packages give `-D` different meanings; the path printed) |
| HOST-19 | The cameras are on a dedicated port and a dedicated switch: one static private `/24` address, no gateway, no name server, no DHCP on that port | file B, then `sudo netplan try` | `ip -br -4 addr show dev <camera-interface>` prints exactly one address; `ip -4 route show default` does not name `<camera-interface>` | to confirm in 9A/H-01 (the netplan renderer of the installation) |
| HOST-20 | Forwarding between the camera port and any other port is off | file C, then `sudo sysctl --system` | `sysctl -n net.ipv4.ip_forward net.ipv6.conf.all.forwarding` prints `0` twice; `cat /proc/sys/net/ipv4/conf/<camera-interface>/forwarding` prints `0` | - |
| HOST-21 | Nothing on the host turns forwarding back on (no container runtime, no virtual machine bridge, no VPN service) | none; such software is not installed on this host | `dpkg -l 'docker*' 'containerd*' 'libvirt*' 'wireguard*'` lists no line that starts with `ii` | to confirm in 9A/H-01 |
| HOST-22 | The firewall is on and denies incoming and routed traffic by default | `sudo ufw default deny incoming`, `sudo ufw default deny routed`, then (the user's own remote-administration rule first, if one is used) `sudo ufw enable` | `sudo ufw status verbose` prints `Status: active` and `Default: deny (incoming), allow (outgoing), deny (routed)` | to confirm in 9A/H-01 |
| HOST-23 | Answers to the camera search arrive: datagrams from source port 3702 are admitted on the camera port | `sudo ufw allow in on <camera-interface> proto udp from any port 3702 comment 'DEMS camera search answers'` | `sudo ufw status numbered` lists the rule with `on <camera-interface>`; the search in the web console lists at least 1 camera | to confirm in 9A/H-12 (whether this rule alone suffices; input-av's tested rule matched destination port 3702 for a passive listener the Core does not have) and 9A/H-13 (answers from a factory subnet through a temporary address) |
| HOST-24 | The Core's own services are not reachable on the camera port or on any temporary address added to it | none: the Core and its database listen on `127.0.0.1` only, and no firewall rule opens their ports | `sudo ss -H -ltnp` shows `127.0.0.1` as the local address of every listener owned by `<service-user>`; `sudo ufw status` holds no `ALLOW` line for ports 4420 to 4423 | to confirm in 9A/H-01 (a connection attempt to those ports from a laptop on the camera switch fails) |
| HOST-25 | Loopback rule: only `<service-user>` can open a connection to `127.0.0.1` ports 8554 to 8564 (the worker's camera listeners) | `sudo apt-get install -y nftables`; file D as `/etc/dems/loopback-ingest.nft` and file E as `/etc/systemd/system/dems-loopback-rule.service`, both owner root, mode 0644; then `sudo systemctl daemon-reload` and `sudo systemctl enable --now dems-loopback-rule.service` | `systemctl is-active dems-loopback-rule.service` prints `active`; `sudo nft list table inet dems_loopback` prints one rule that holds `tcp dport 8554-8564` and `skuid != <service-user>`; after one connection attempt to `127.0.0.1` port 8554 from the administrator account, the rule's `counter packets` figure has risen by at least 1 | to confirm in 9A/H-01 (the rule beside the firewall of HOST-22; the rule after a restart) |

### 3.5 Audio access

| Id | Item | Command or file | Check that shows it took effect | Confirm |
|---|---|---|---|---|
| HOST-26 | ALSA tools present; the service user may open the sound devices without a desktop login | `sudo apt-get install -y alsa-utils`, `sudo usermod -aG audio <service-user>` | `id -nG <service-user>` holds `audio`; with the interface connected, `sudo runuser -u <service-user> -- arecord -l` lists it as a card | to confirm in 9A/H-07 (the listing on the real interface) |
| HOST-27 | The audio interface is USB Audio Class (no vendor driver) | none (a property of the device) | `lsusb` lists the interface; `cat /proc/asound/cards` names it with the driver `USB-Audio` | to confirm in 9A/H-07 |
| HOST-28 | No sound server holds the interface, so that ALSA shared capture can open it | none on a server installation; on a desktop installation the user's session sound server is kept away from this card | with no session running: `sudo fuser -v /dev/snd/pcmC*D*c` prints no process | to confirm in 9A/H-08 (shared capture opening on both inputs) |

### 3.6 Sleep and time

| Id | Item | Command or file | Check that shows it took effect | Confirm |
|---|---|---|---|---|
| HOST-29 | The host never sleeps or hibernates | `sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target` | `systemctl is-enabled sleep.target suspend.target hibernate.target hybrid-sleep.target` prints `masked` 4 times | - |
| HOST-30 | On a host with a lid: closing it does nothing | file F as `/etc/systemd/logind.conf.d/60-dems-lid.conf`, then a restart of the host | `systemd-analyze cat-config systemd/logind.conf` shows the three `HandleLidSwitch` lines of file F | to confirm in 9A/H-01 (only if the host has a lid) |
| HOST-31 | The host's clock is synchronised | `sudo timedatectl set-ntp true` | `timedatectl show -p NTPSynchronized --value` prints `yes` | to confirm in 9A/H-01 (the time source at a site without Internet access is the site's decision) |
| HOST-32 | The Core starts only after the clock is synchronised | `sudo systemctl enable systemd-time-wait-sync.service`; `After=time-sync.target` in the unit (file G) | `systemctl is-enabled systemd-time-wait-sync.service` prints `enabled`; `systemctl show dems-core.service -p After` holds `time-sync.target` | to confirm in 9A/H-01 (a host without a reachable time source would then not start the Core) |

### 3.7 The Core's service unit

| Id | Item | Command or file | Check that shows it took effect | Confirm |
|---|---|---|---|---|
| HOST-33 | The unit file, owned by root | file G as `/etc/systemd/system/dems-core.service`, owner root, mode 0644; `sudo systemctl daemon-reload` | `sudo systemd-analyze verify /etc/systemd/system/dems-core.service` prints no error; `stat -c '%U %G %a' /etc/systemd/system/dems-core.service` prints `root root 644` | to confirm in 9A/H-16 (the start command of a production Core) |
| HOST-34 | The environment file: owner root, readable by the service user's group, no development switch in it | `/etc/dems/core.env`, owner root, group `<service-user>`, mode 0640; it sets `DEMS_CAPTURE_MODE=real`, `DEMS_CAPTURE_WORKER` (the absolute path of HOST-14), `DEMS_MEDIA_DIR`, and the database settings; its values are the user's and are not printed anywhere | `sudo stat -c '%U %G %a' /etc/dems/core.env` prints `root <service-user> 640`; `sudo grep -c -E '^(DEMS_CAPTURE_DEV_SOURCES\|DEMS_DEMO_CONTROLS\|NODE_OPTIONS)=' /etc/dems/core.env` prints `0` | to confirm in 9A/H-16 |
| HOST-35 | Core-file limit of the Core is 0 | `LimitCORE=0` in file G | `systemctl show dems-core.service -p LimitCORE` prints `LimitCORE=0`; `sudo grep 'Max core file size' /proc/<core-pid>/limits` prints `0` in both limit columns | - |
| HOST-36 | The Core is started without a diagnostic-report switch, a heap-snapshot switch or a debugger switch | the `ExecStart` line and the environment file hold none of: `--report-on-fatalerror`, `--report-uncaught-exception`, `--report-on-signal`, `--report-compact`, `--diagnostic-dir`, `--heapsnapshot-signal`, `--heapsnapshot-near-heap-limit`, `--heap-prof`, `--inspect`, and no `NODE_OPTIONS` | `sudo tr '\0' '\n' < /proc/<core-pid>/cmdline` prints no line that starts with `--report`, `--diagnostic`, `--heap` or `--inspect`; `sudo tr '\0' '\n' < /proc/<core-pid>/environ` prints no line that starts with `NODE_OPTIONS=` | to confirm in 9A/H-01 (the switch list against the installed Node.js version) |
| HOST-37 | The system's crash collector does not take a memory image of the Core | `sudo systemctl disable --now apport.service`; the two core lines of file C, then `sudo sysctl --system` | `systemctl is-enabled apport.service` prints `disabled` or `masked`; `sysctl -n kernel.core_pattern` prints the value of file C; `sysctl -n fs.suid_dumpable` prints `0`; `ls /var/crash` prints nothing | to confirm in 9A/H-01 (author's recollection, not read on a host: a core pattern that pipes to a program is not stopped by a limit of 0, so HOST-35 alone may not be enough) |
| HOST-38 | The Core cannot gain privileges | `NoNewPrivileges=yes` in file G | `systemctl show dems-core.service -p NoNewPrivileges` prints `NoNewPrivileges=yes`; `sudo grep NoNewPrivs /proc/<core-pid>/status` prints `NoNewPrivs:	1` | to confirm in 9A/H-06 (the helper still works from inside this unit) |
| HOST-39 | The Core has an empty capability bounding set and no ambient capability | `CapabilityBoundingSet=` and `AmbientCapabilities=` in file G, both with nothing after the equals sign | `sudo grep -E '^Cap(Prm\|Eff\|Bnd\|Amb)' /proc/<core-pid>/status` prints 4 lines, each ending in `0000000000000000` | to confirm in 9A/H-17 (a session records with this in force) |
| HOST-40 | The Core runs with the audio group and the helper's group, and no other supplementary group | `SupplementaryGroups=audio <helper-group>` in file G | `sudo grep '^Groups:' /proc/<core-pid>/status` lists exactly the two group numbers that `getent group audio <helper-group>` prints | to confirm in 9A/H-05 |
| HOST-41 | The Core starts only with the loopback rule in place | `Requires=dems-loopback-rule.service` and `After=dems-loopback-rule.service` in file G | `systemctl show dems-core.service -p Requires` holds `dems-loopback-rule.service`; after `sudo systemctl stop dems-loopback-rule.service` the Core is stopped too (then both are started again) | to confirm in 9A/H-04 |
| HOST-42 | Files the Core creates are owner-only by default | `UMask=0077` in file G | `sudo grep '^Umask:' /proc/<core-pid>/status` prints `Umask:	0077` | - |

### 3.8 The address helper as installed

The helper adds and removes one temporary private address on the camera port, so that a factory-new camera can be reached. It is a root service on a local socket: one group, two unit files, no sudoers file. It is installed by the user after its security review, by the helper's own installation procedure, which prints the hashes to compare and the steps. The lines below are the state that procedure must leave; unit and group names are fixed by the helper's delivery.

| Id | Item | Command or file | Check that shows it took effect | Confirm |
|---|---|---|---|---|
| HOST-43 | A dedicated group whose only member is the service user | `sudo groupadd --system <helper-group>`, `sudo usermod -aG <helper-group> <service-user>` | `getent group <helper-group>` prints one line whose member list is exactly `<service-user>` | to confirm in 9A/H-05 |
| HOST-44 | The socket unit and the template service unit, owned by root; the socket active | the two unit files of the helper's delivery copied to `/etc/systemd/system/`, owner root, mode 0644; `sudo systemd-analyze verify` on both; `sudo systemctl daemon-reload`; `sudo systemctl enable --now` on the socket unit | `systemctl is-active` on the socket unit prints `active`; `stat -c '%U %G %a'` on the socket node prints `root <helper-group> 660`; `stat -c '%U %G %a'` on both unit files prints `root root 644` | to confirm in 9A/H-05 |
| HOST-45 | The helper file: owner root, group root, mode 0755, not a symbolic link, every parent directory root-owned | as the helper's installation procedure states | `namei -l` on the helper's path shows owner `root` and no `w` for group or others on every component, and no `l` type; `sha256sum` on it equals the hash the procedure prints | to confirm in 9A/H-05 |
| HOST-46 | The interface file: one line that names `<camera-interface>`, owner root, mode 0644; it is not the port of the default route | as the helper's installation procedure states | `cat` on the file prints one line; `ip -4 route show default` names another interface; `stat -c '%U %a'` on the file prints `root 644` | to confirm in 9A/H-05 |
| HOST-47 | No sudoers line names the helper | none (nothing is written) | `sudo grep -r -c netalias /etc/sudoers /etc/sudoers.d` prints `0` after every file name | to confirm in 9A/H-27 |

### 3.9 Camera activation, and the final check

| Id | Item | Command or file | Check that shows it took effect | Confirm |
|---|---|---|---|---|
| HOST-48 | A factory-new camera is activated in its own web page from a browser on the Core host or on a laptop plugged into the camera switch; the web console does not relay a camera's page | none on the host; an installation step with the camera | the camera's page opens from that browser while the temporary address is in place, and the camera then answers the factory-address scan | to confirm in 9A/H-13 |
| HOST-49 | The Core's start names no missing prerequisite of this profile | `sudo systemctl start dems-core.service` | `journalctl -u dems-core.service -b --no-pager` holds no line that names a missing host prerequisite; with one prerequisite removed on purpose, the start names exactly that one | to confirm in 9A/H-04 |

### 3.10 The database server (PostgreSQL)

These seven items are a PROPOSAL with its open choices stated. No PostgreSQL procedure for Ubuntu exists in the product tree: the development machine runs PostgreSQL 18.4 from embedded binaries for macOS, provisioned into the product tree. None of the items has run on any Linux host, and no hardware check `9A/H-nn` names them yet, so their Confirm cell reads "to confirm on the host" and nothing more specific. The script `95-database.sh` prints the same seven steps under the names DB-01 to DB-07 (DB-01 is HOST-50, and so on in order); it has no apply mode. In time they come before HOST-49: the Core cannot start without its database.

| Id | Item | Command or file | Check that shows it took effect | Confirm |
|---|---|---|---|---|
| HOST-50 | Where the PostgreSQL server comes from: an open choice of the user between (A) the distribution's package, (B) the PostgreSQL project's packages for Ubuntu 24.04, version 18, (C) the embedded binaries the development uses | A: `sudo apt-get install -y postgresql` (its version on Ubuntu 24.04 is not read on a host; the author recalls 16). B: adds a third-party package source and its signing key to the host, a decision of the user, and needs a network path the room may not have. C: not usable as it is: the product's package file allows the install script of the macOS binaries only, no Linux binary package was ever installed or tried, and the provisioning command writes into the product tree, which HOST-05 makes root-owned | the version the installed server states (`psql --version`, or `SELECT version()`) is recorded | to confirm on the host (which of A, B, C; the version the distribution carries) |
| HOST-51 | The server's version: 18.4 is the only one the migrations and the database tests have run on | none beyond HOST-50; a host on another major version runs the product on an untested server, so either choice B or C of HOST-50 is taken, or the database suite is repeated on the host's version before acceptance, by a ruling | `SHOW server_version` prints the version, which is recorded in the header of the acceptance record | to confirm on the host |
| HOST-52 | The server's data directory is owned by the server's account, mode 0700, and is not inside `<install-dir>`. It holds the audit chain: no step of this profile removes it | none stated: on the evidence disk beside `<data-dir>` or on the system disk is open; the distribution package's default is under `/var/lib/postgresql` | `sudo stat -c '%U %a'` on the data directory prints the server's account and `700` | to confirm on the host (the place of the data directory) |
| HOST-53 | The server listens on `127.0.0.1` only (the database half of HOST-24) | in `postgresql.conf`, by the user: `listen_addresses = '127.0.0.1'`. Open: the port (the development used 4432, the distribution's default is 5432; the database settings of `/etc/dems/core.env`, HOST-34, name it) and whether the server's local socket stays (the development turned it off with `unix_socket_directories = ''`) | `sudo ss -H -ltn` shows the database port with the local address `127.0.0.1` and no other; `sudo ufw status` holds no `ALLOW` line for the database port | to confirm on the host (the port; the local socket) |
| HOST-54 | Two roles of the project: an owner role (create, migrate, seed) and a runtime role (the running Core) | created by the user; their secrets are set by the user and are never an argument of a command, never printed and never written into a script or this document. The runtime settings reach the Core through `/etc/dems/core.env` (HOST-34). Open: where the owner settings live on a host whose product tree is root-owned (the development keeps them inside the tree) | in `psql`, read by the user: `\du` shows that the runtime role is not a superuser, and `\dt` that it does not own the tables | to confirm on the host (the place of the owner settings) |
| HOST-55 | The database `dems_demo`: the name the acceptance procedure expects | from `<install-dir>`, with the owner settings of HOST-54: `npm run db:create -- --database dems_demo`, then `npm run db:migrate -- --database dems_demo`, then `npm run db:seed -- --database dems_demo`. The database commands accept a closed list of names; a seeded `dems_demo` holds the demonstration data set. Open, for the user: whether the installation goes into service on this database or on a new one after acceptance | `npm run db:status -- --database dems_demo` exits 0; the schema version it prints is recorded | to confirm on the host |
| HOST-56 | The Core starts after the database server | none stated: file G (HOST-33) names no database unit. With a server of the distribution the Core's unit would gain `After=` and `Wants=` on that server's unit, whose name depends on HOST-50 and is not known here | after a restart of the host the Core is active without a manual start, and its journal names no database connection failure | to confirm on the host (the unit name of the server) |

## 4. Files

Each file is written by the user as root. Placeholders are replaced by the user's values on the host.

**File A** `/etc/ld.so.conf.d/dems-ffmpeg.conf` (HOST-13)

```
<ffmpeg-prefix>/lib
```

**File B** `/etc/netplan/60-dems-camera.yaml`, mode 0600 (HOST-19)

```yaml
network:
  version: 2
  ethernets:
    <camera-interface>:
      dhcp4: false
      dhcp6: false
      accept-ra: false
      addresses:
        - <camera-address>/24
```

**File C** `/etc/sysctl.d/60-dems-host.conf` (HOST-20, HOST-37)

```
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0
kernel.core_pattern = |/bin/false
fs.suid_dumpable = 0
```

**File D** `/etc/dems/loopback-ingest.nft` (HOST-25). The first two lines make the file safe to load twice; it touches no table but its own.

```
table inet dems_loopback
delete table inet dems_loopback
table inet dems_loopback {
    chain output {
        type filter hook output priority filter; policy accept;
        oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != "<service-user>" counter reject with tcp reset
    }
}
```

**File E** `/etc/systemd/system/dems-loopback-rule.service` (HOST-25)

```ini
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
```

**File F** `/etc/systemd/logind.conf.d/60-dems-lid.conf` (HOST-30)

```ini
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
```

**File G** `/etc/systemd/system/dems-core.service` (HOST-33 to HOST-42). The `ExecStart` line is not settled: the repository starts the Core with its `start` script of `apps/core-server`, and the form of a production start is confirmed in 9A/H-16. Whatever it becomes, it is an absolute path and carries none of the switches of HOST-36. No further hardening option is set on purpose: each one would need its own item and its own check with a session recording.

```ini
[Unit]
Description=DEMS Core
After=network-online.target time-sync.target dems-loopback-rule.service
Wants=network-online.target
Requires=dems-loopback-rule.service

[Service]
User=<service-user>
Group=<service-user>
SupplementaryGroups=audio <helper-group>
WorkingDirectory=<install-dir>
EnvironmentFile=/etc/dems/core.env
ExecStart=<absolute path of node> <start arguments of the Core, to confirm in 9A/H-16>
UMask=0077
LimitCORE=0
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
```

## 5. What this profile cannot settle without the host

Each line is open until the named check has run on the real machine. A result from a container is a container result and settles none of them for the host.

| # | Open point | Why it needs the host | Settled by |
|---|---|---|---|
| 1 | The sync level on the evidence disk. On a build without the macOS full-sync call the worker is expected to state a weaker level, which a production Core reports as one CRITICAL alert per session. If that happens in every session it is a finding that needs a decision; it is not waved through | the level is stated by the worker on the real disk; a container's file system is not that disk | 9A/H-03 |
| 2 | FFmpeg 9.0.2 configures and builds on Ubuntu 24.04 with the line of HOST-12, and that feature set carries the capture path. The capture series was verified on another build of the same version; the licence of the build that ships is the user's open decision | no Ubuntu build has been made | the Ubuntu 24.04 container build of the development track, then 9A/H-01 |
| 3 | The worker, the relay and the guard compile and pass their own checks on Linux: the compiler named in the build file, the list of imported file functions fixed on macOS, the capture series on this host | first build off macOS | the container build, then 9A/H-01 |
| 4 | Which FFmpeg version and which `arping` packages Ubuntu 24.04 really carries | hypotheses of the plan review, not read on a host | the container build; 9A/H-25 |
| 5 | The conflict check refuses an address that is taken, with the iputils tool | needs a second device on the camera switch | 9A/H-25 |
| 6 | The process listing's short name, and the detection of a leftover process after a killed Core | Linux process table | 9A/H-24 |
| 7 | No child process outlives the Core. With file G the service manager also ends every process of the unit when the Core dies, which can hide whether the Core's own liveness rule worked; the check states which of the two ended the children | real kernel and service manager | 9A/H-02, 9A/H-24 |
| 8 | Search answers pass the firewall with the rule of HOST-23, on the camera subnet and from a factory subnet | needs a real camera | 9A/H-12, 9A/H-13 |
| 9 | The loopback rule beside the firewall, after a restart, and how the Core's own start check can see it: a Core with no capability may not be able to list the rule set, so its check may have to read the state of the unit of file E instead | real kernel; the Core's check is built on recorded outputs only | 9A/H-01, 9A/H-04 |
| 10 | The real card listing, a stable identity after a re-plug, shared capture on both inputs, the absence of a sound server | ALSA does not exist on the development machine | 9A/H-07, 9A/H-08 |
| 11 | The Core records with `NoNewPrivileges=yes`, an empty capability set and the two groups in force, and the helper answers from inside that unit | the unit has never run | 9A/H-05, 9A/H-06, 9A/H-17 |
| 12 | The crash collector of Ubuntu and a core pattern that pipes to a program: whether HOST-35 alone prevents a memory image, and whether HOST-37 has a side effect on the host | author's recollection only | 9A/H-01 |
| 13 | The socket of the helper as the service manager creates it: owner, group, mode, refusal of another account | socket activation has not run | 9A/H-05 |
| 14 | The time source at the site, and what happens to the Core's start when none is reachable (HOST-32) | site decision | 9A/H-01 |
| 15 | The listener of the worker refuses a push to a wrong path on this host's build of the library, as it did on the development machine | the behaviour belongs to the library build | the container repeat, then 9A/H-01 |
| 16 | The limits of the relay process (no core file, no new privileges) as observed in the process table during a session | observed, not assumed | the container run, then 9A/H-01 |

**Outside this profile, named so that nobody looks for them here:**

- The database on the host beyond the seven proposed items HOST-50 to HOST-56 (section 3.10): the choice of the server's source, the roles' secrets, and the decision on which database the installation goes into service. They are steps of the installation procedure, performed by the user; no script of this profile applies any of them.
- The production signing key and operators without the published demonstration password. A production Core refuses to start without them.
- How the tablet, the phone and the web console reach a Core whose listener is bound to `127.0.0.1`. The design documents this profile is built from do not state it.
- The steps of the helper's installation, its nine proofs of refusal and its removal: the helper's own procedure.
- Camera settings: replacing the factory password before a camera is adopted, setting the camera's clock, the keyframe interval.
- The user's acceptance of digest authentication over an unencrypted camera network in production. The dedicated port, the dedicated switch and HOST-20 are the host's part of that condition; the acceptance itself is a decision of the user.

## 6. Removal

To take the profile's own changes away, as the user: stop and disable `dems-core.service` and `dems-loopback-rule.service`; remove files A to G and `/etc/dems/`; run `sudo systemctl daemon-reload`, `sudo ldconfig`, `sudo sysctl --system` and `sudo netplan apply`; delete the firewall rule of HOST-23 by its number; unmask the four targets of HOST-29; remove `<service-user>` from the two groups. The helper is removed by its own procedure. `<data-dir>` holds evidence: it is not removed by any step of this document.
