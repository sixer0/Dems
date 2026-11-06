# DEMS Core: Linux host profile for Ubuntu 24.04

**Status of this document: UNVERIFIED on Ubuntu.** It was written on a development Mac with no Linux host available. No command below has been run on Ubuntu 24.04, and nothing here has been applied to any machine. Every command and every expected output is a statement of intent until the hardware acceptance package (checks `9A/H-01` to `9A/H-27`) has run on the real host. An item the author is unsure of carries "to confirm in 9A/H-nn" in its last column; an item without that mark is still unverified, it is only not doubted.

This document installs nothing by itself. It is a list to be applied by a person.

**Revision of 2026-10-14** (the document row of wave 12; still unverified on Ubuntu, nothing was run). Added or changed: which hosts may run a production Core and what a Mac does not check (below); the parents of the data directory (HOST-06); the key of the microphone helper (HOST-16); the package, the path and the package manager's records of the conflict-check tool, and the path of `ip` (HOST-18); the path of the card listing program (HOST-26); the keys of the environment file and the mode of `/etc/dems` (HOST-34); that the service user reads the interface file (HOST-46); the address helper is optional, all of it or none (section 3.8); the two programs the Core starts for the commissioning functions (section 3.11); open point 9 of section 5 settled by a measurement. No item was added or removed: the items are HOST-01 to HOST-56 as before.

**Revision of 2026-10-22 (R-FLEX; decisions D10, D11, D12 of task 2026-10-21_bare_metal_bench; still unverified on Ubuntu).** The Core no longer limits the camera search and camera connections to the camera port. They run on every IPv4 network the host is attached to (D10 ruling 2), a risk the user accepted (D11). The camera port, forwarding off and the firewall stay, as host hygiene. Changed: the placeholder `<camera-interface>`, HOST-19, HOST-23 (the search-answer rule admits the camera port and, since decision D33 M-6 of 2026-10-22, the Wi-Fi port; it replaced D12 U-RF3), HOST-24, HOST-46 (wording), the posture paragraph of section 3.4, the echo note of section 3.11, open point 8 and the digest-authentication line of section 5. No item was added or removed: the items are HOST-01 to HOST-56 as before.

**Which hosts may run a production Core.** A Core in production capture (`DEMS_CAPTURE_MODE=real` without `DEMS_CAPTURE_DEV_SOURCES`) starts on Linux and on macOS only; any other platform is refused at the start with `CAPTURE_HOST_PLATFORM_NOT_SUPPORTED`. **This profile is the hardened form, and only a Linux host is held to it**: there the Core asks the items it can ask at every start and refuses when one is not met. **On a Mac none of the following is asked:** HOST-18 (the arping variant), HOST-20 (forwarding), HOST-25 and HOST-41 (the loopback rule: any account of the Mac can connect to the worker's camera listeners), HOST-26 and HOST-40 (the audio group), HOST-29 (sleep), HOST-31 (clock synchronisation), HOST-37 (the crash collector), HOST-38 (no new privileges), HOST-44 to HOST-46 (the address helper's socket, file, grant and interface file). Still asked on a Mac: HOST-35 (core-file limit 0), HOST-36 (no diagnostic switch, no `NODE_OPTIONS`), the relay and guard programs under the path rule (HOST-05, HOST-15) and the relay's stated media library. A Mac says so in three places: the log line `CAPTURE_HOST_PROFILE_NOT_ASKED` at every start, the audit entry `SYSTEM_BOOT` (`hostPlatform: darwin`, `hostProfile: WILL_NOT_BE_ASKED`), and the signed manifest of every package it seals (`hostProfileNotAsked: { platform: "darwin" }`).

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
| `<camera-interface>` | The network port dedicated to the cameras (HOST-19), and the one port on which the address helper acts (HOST-46). Since R-FLEX it is not the only port on which the Core reaches cameras |
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
| HOST-06 | The data directory and the media store belong to the service user and are owner-only. **No directory above `<data-dir>` is writable by a group or by others**: the signing key lies under `<data-dir>/signer`, and whoever may write a parent may replace the directory. The key command asks this when the key is made; the Core does not ask it again at each start, so it is a requirement of this profile | `sudo install -d -o <service-user> -g <service-user> -m 0700 <data-dir> <data-dir>/media <data-dir>/media/sessions`; every parent of `<data-dir>` is made, or left, owner root with mode 0755 | `sudo stat -c '%U %G %a' <data-dir> <data-dir>/media/sessions` prints `<service-user> <service-user> 700` twice; `namei -l <data-dir>` shows no `w` for group or others on any component above `<data-dir>`; a real-capture Core that starts does not report `CAPTURE_EVIDENCE_STORE_UNUSABLE` | - |
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
| HOST-16 | The microphone helper is the pinned FFmpeg program, reached by an absolute root-owned path | none beyond HOST-12; the environment file names it: `DEMS_CAPTURE_AUDIO_HELPER=<ffmpeg-prefix>/bin/ffmpeg`, an absolute path (HOST-34). Unset, no production microphone can be opened. The program is started by the guard, never directly | `namei -l <ffmpeg-prefix>/bin/ffmpeg` shows owner `root` and no `w` for group or others on every component | to confirm in 9A/H-08 (that the program this key names opens the ALSA shared capture of a real card) |
| HOST-17 | The process listing gives the full program path to the Core's leftover check | `procps` (part of a default installation) | `ps -axo pid=,comm=` prints short names (at most 15 characters) and `ps -axo pid=,args=` prints full paths; both observations are recorded | to confirm in 9A/H-24 |

### 3.4 The camera port, the firewall, the loopback rule

**Posture since R-FLEX (D10 ruling 2, D11).** The Core searches for cameras and connects to them on every IPv4 network of the host, the room network included, so a signed-in technician can make the Core dial a private address on any of them; the user accepted that risk (D11). The Core's guards that do not depend on the port stay: an IPv4 literal only, private ranges only, no special address classes, never the host's own addresses, no subnet edge addresses, the port list, and the scan size and spacing. The items below no longer make the camera port the Core's only camera path. They keep the camera network clean (HOST-19), stop the host from joining its networks (HOST-20, HOST-21), keep the Core's own services off every network (HOST-22, HOST-24), and admit search answers on the camera port and the Wi-Fi port only (HOST-23, D33 M-6: the user accepted that the search-answer reader is reachable from the Wi-Fi network so that Wi-Fi cameras are listed by the plain search).

| Id | Item | Command or file | Check that shows it took effect | Confirm |
|---|---|---|---|---|
| HOST-18 | The conflict-check tool is the iputils one, the package `iputils-arping`, at the path `/usr/bin/arping`, the only path the address helper calls it by; the other package named `arping` is absent. The package manager's two records of it are in place and agree with the file: the helper reads them before it ever starts the tool and refuses every `add` (`38 CONFLICT_TOOL_NOT_EXPECTED`) when they do not. The network tool is `/usr/sbin/ip` of the package `iproute2`: the helper and the Core both call it by that path. Python 3.9 or later for the helper (Ubuntu 24.04 carries 3.12). The Core asks the arping variant at every production start on Linux, whether or not the helper is installed | `sudo apt-get install -y iputils-arping iproute2` | `dpkg -S "$(command -v arping)"` prints `iputils-arping: /usr/bin/arping`; `dpkg -s arping` prints `is not installed`; `grep -x /usr/bin/arping /var/lib/dpkg/info/iputils-arping.list` prints the path; `grep '  usr/bin/arping$' /var/lib/dpkg/info/iputils-arping.md5sums` prints one line whose first 32 characters equal those of `md5sum /usr/bin/arping`; `dpkg --verify iputils-arping` prints nothing; `stat -L -c '%U %a %n' /usr/sbin/ip /usr/bin/arping` prints two lines that begin `root 755` | to confirm in 9A/H-25 (the two packages give `-D` different meanings; the path printed) |
| HOST-19 | The camera port is a dedicated port with a dedicated switch: one static private `/24` address, no gateway, no name server, no DHCP on that port. Host hygiene: since R-FLEX the Core also reaches cameras on other networks of the host, but the cameras of this installation are on this port, and it never carries the default route | file B, then `sudo netplan try`; or the same settings in the host's network manager, held to the same two checks | `ip -br -4 addr show dev <camera-interface>` prints exactly one address; `ip -4 route show default` does not name `<camera-interface>` | to confirm in 9A/H-01 (the netplan renderer of the installation) |
| HOST-20 | Forwarding between the camera port and any other port is off | file C, then `sudo sysctl --system` | `sysctl -n net.ipv4.ip_forward net.ipv6.conf.all.forwarding` prints `0` twice; `cat /proc/sys/net/ipv4/conf/<camera-interface>/forwarding` prints `0` | - |
| HOST-21 | Nothing on the host turns forwarding back on (no container runtime, no virtual machine bridge, no VPN service) | none; such software is not installed on this host | `dpkg -l 'docker*' 'containerd*' 'libvirt*' 'wireguard*'` lists no line that starts with `ii` | to confirm in 9A/H-01 |
| HOST-22 | The firewall is on and denies incoming and routed traffic by default | `sudo ufw default deny incoming`, `sudo ufw default deny routed`, then (the user's own remote-administration rule first, if one is used) `sudo ufw enable` | `sudo ufw status verbose` prints `Status: active` and `Default: deny (incoming), allow (outgoing), deny (routed)` | to confirm in 9A/H-01 |
| HOST-23 | Answers to the camera search arrive on the camera port and on the Wi-Fi port: datagrams from source port 3702 are admitted on those two ports and on no other port of the host (decision D33 M-6, replacing D12 U-RF3; the user accepted that the search-answer reader is reachable from the Wi-Fi network). The search also asks on the other networks of the host; their answers are not admitted, so a camera there is reached by its typed address | `sudo ufw allow in on <camera-interface> proto udp from any port 3702 comment 'DEMS camera search answers'` and `sudo ufw allow in on <search-interface> proto udp from any port 3702 comment 'DEMS camera search answers (Wi-Fi, D33)'` | `sudo ufw status numbered` lists the rule with `on <camera-interface>` and the rule with `on <search-interface>`, and no other rule names port 3702; the search in the web console lists at least 1 camera | to confirm in 9A/H-12 (whether this rule alone suffices; input-av's tested rule matched destination port 3702 for a passive listener the Core does not have) and 9A/H-13 (answers from a factory subnet through a temporary address); and 9A/H-12 (that a typed address on another network of the host is answered with this rule alone) |
| HOST-24 | The Core's own services are not reachable from any network of the host: not on the camera port, not on any temporary address added to it, not on the room network | none: the Core and its database listen on `127.0.0.1` only, and no firewall rule opens their ports | `sudo ss -H -ltnp` shows `127.0.0.1` as the local address of every listener owned by `<service-user>`; `sudo ufw status` holds no `ALLOW` line for ports 4420 to 4423 | to confirm in 9A/H-01 (a connection attempt to those ports from a laptop on the camera switch, and from a machine on the room network, fails) |
| HOST-25 | Loopback rule: only `<service-user>` can open a connection to `127.0.0.1` ports 8554 to 8564 (the worker's camera listeners) | `sudo apt-get install -y nftables`; file D as `/etc/dems/loopback-ingest.nft` and file E as `/etc/systemd/system/dems-loopback-rule.service`, both owner root, mode 0644; then `sudo systemctl daemon-reload` and `sudo systemctl enable --now dems-loopback-rule.service` | `systemctl is-active dems-loopback-rule.service` prints `active`; `sudo nft list table inet dems_loopback` prints one rule that holds `tcp dport 8554-8564` and `skuid != <service-user>`; after one connection attempt to `127.0.0.1` port 8554 from the administrator account, the rule's `counter packets` figure has risen by at least 1 | to confirm in 9A/H-01 (the rule beside the firewall of HOST-22; the rule after a restart) |

### 3.5 Audio access

| Id | Item | Command or file | Check that shows it took effect | Confirm |
|---|---|---|---|---|
| HOST-26 | ALSA tools present; the service user may open the sound devices without a desktop login. The Core lists the sound cards with the fixed program `/usr/bin/arecord -l`: the path is a constant of the product, no key names it, and no other path is tried | `sudo apt-get install -y alsa-utils` (the package that installs `/usr/bin/arecord`), `sudo usermod -aG audio <service-user>` | `id -nG <service-user>` holds `audio`; `dpkg -S /usr/bin/arecord` prints `alsa-utils: /usr/bin/arecord`; with the interface connected, `sudo runuser -u <service-user> -- /usr/bin/arecord -l` lists it as a card | to confirm in 9A/H-07 (the listing on the real interface) |
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
| HOST-34 | The environment file: owner root, readable by the service user's group, no development switch in it | the folder `/etc/dems`, owner root, group root, mode 0755 (the service user must be able to pass it: it reads this file and the helper's interface file there, and writes neither); in it `/etc/dems/core.env`, owner root, group `<service-user>`, mode 0640; it sets `DEMS_CAPTURE_MODE=real`, `DEMS_CAPTURE_WORKER` (the absolute path of HOST-14), `DEMS_CAPTURE_RELAY` and `DEMS_CAPTURE_GUARD` (the absolute paths of HOST-15), `DEMS_CAPTURE_AUDIO_HELPER` (the absolute path of HOST-16; unset, no production microphone can be opened), `DEMS_MEDIA_DIR`, the installation device id, and the database settings. `DEMS_CAPTURE_ALIAS_SOCKET` is set only on a host that carries the address helper, and then to exactly `/run/dems-core-netalias/socket`, the path the delivered socket unit installs: any other value refuses a production start (`CAPTURE_HOST_ALIAS_SOCKET_PATH`); unset, the Core does not dial the helper and the commissioning functions are not available. The values of the file are the user's and are not printed anywhere | `sudo stat -c '%U %G %a' /etc/dems` prints `root root 755`; `sudo stat -c '%U %G %a' /etc/dems/core.env` prints `root <service-user> 640`; `sudo grep -c -E '^(DEMS_CAPTURE_DEV_SOURCES\|DEMS_DEMO_CONTROLS\|NODE_OPTIONS)=' /etc/dems/core.env` prints `0` | to confirm in 9A/H-16 |
| HOST-35 | Core-file limit of the Core is 0 | `LimitCORE=0` in file G | `systemctl show dems-core.service -p LimitCORE` prints `LimitCORE=0`; `sudo grep 'Max core file size' /proc/<core-pid>/limits` prints `0` in both limit columns | - |
| HOST-36 | The Core is started without a diagnostic-report switch, a heap-snapshot switch or a debugger switch | the `ExecStart` line and the environment file hold none of: `--report-on-fatalerror`, `--report-uncaught-exception`, `--report-on-signal`, `--report-compact`, `--diagnostic-dir`, `--heapsnapshot-signal`, `--heapsnapshot-near-heap-limit`, `--heap-prof`, `--inspect`, and no `NODE_OPTIONS` | `sudo tr '\0' '\n' < /proc/<core-pid>/cmdline` prints no line that starts with `--report`, `--diagnostic`, `--heap` or `--inspect`; `sudo tr '\0' '\n' < /proc/<core-pid>/environ` prints no line that starts with `NODE_OPTIONS=` | to confirm in 9A/H-01 (the switch list against the installed Node.js version) |
| HOST-37 | The system's crash collector does not take a memory image of the Core | `sudo systemctl disable --now apport.service`; the two core lines of file C, then `sudo sysctl --system` | `systemctl is-enabled apport.service` prints `disabled` or `masked`; `sysctl -n kernel.core_pattern` prints the value of file C; `sysctl -n fs.suid_dumpable` prints `0`; `ls /var/crash` prints nothing | to confirm in 9A/H-01 (author's recollection, not read on a host: a core pattern that pipes to a program is not stopped by a limit of 0, so HOST-35 alone may not be enough) |
| HOST-38 | The Core cannot gain privileges | `NoNewPrivileges=yes` in file G | `systemctl show dems-core.service -p NoNewPrivileges` prints `NoNewPrivileges=yes`; `sudo grep NoNewPrivs /proc/<core-pid>/status` prints `NoNewPrivs:	1` | to confirm in 9A/H-06 (the helper still works from inside this unit) |
| HOST-39 | The Core has an empty capability bounding set and no ambient capability | `CapabilityBoundingSet=` and `AmbientCapabilities=` in file G, both with nothing after the equals sign | `sudo grep -E '^Cap(Prm\|Eff\|Bnd\|Amb)' /proc/<core-pid>/status` prints 4 lines, each ending in `0000000000000000` | to confirm in 9A/H-17 (a session records with this in force) |
| HOST-40 | The Core runs with the audio group and the helper's group, and no other supplementary group. The group of HOST-43 is created before the unit is first started, also on a host whose helper is installed later or never: a unit that names a group the host does not have is not started | `SupplementaryGroups=audio <helper-group>` in file G | `sudo grep '^Groups:' /proc/<core-pid>/status` lists exactly the two group numbers that `getent group audio <helper-group>` prints | to confirm in 9A/H-05 |
| HOST-41 | The Core starts only with the loopback rule in place | `Requires=dems-loopback-rule.service` and `After=dems-loopback-rule.service` in file G | `systemctl show dems-core.service -p Requires` holds `dems-loopback-rule.service`; after `sudo systemctl stop dems-loopback-rule.service` the Core is stopped too (then both are started again) | to confirm in 9A/H-04 |
| HOST-42 | Files the Core creates are owner-only by default | `UMask=0077` in file G | `sudo grep '^Umask:' /proc/<core-pid>/status` prints `Umask:	0077` | - |

### 3.8 The address helper as installed

The helper adds and removes one temporary private address on the camera port, so that a factory-new camera can be reached. It is a root service on a local socket: one group, two unit files, no sudoers file. It is installed by the user after its security review, by the helper's own installation procedure, which prints the hashes to compare and the steps. The lines below are the state that procedure must leave; unit and group names are fixed by the helper's delivery.

**The helper is optional; all of it or none (2026-10-14; decision C94 (j)).** A recording host that never commissions a camera through the Core need not carry it. On a host with NOTHING of the helper (no socket node, no helper file, no directory of the socket, no unit file) a production Core starts and says so: one warning with the code `CAPTURE_HOST_ALIAS_HELPER_ABSENT`, and the audit entry `SYSTEM_BOOT` with `addressHelperSocket: NOT_PRESENT`; the commissioning functions then answer their own refusal. A helper of which only a PART is there, or of which a part is not as delivered, refuses the start (HOST-44, HOST-45). So HOST-44 to HOST-46 are applied in one sitting with the Core stopped, and a helper that leaves the host is removed as a whole; stopping the socket unit alone while the files stay refuses the next start. HOST-43, the group, is the exception: file G names it (HOST-40), so it exists on every host, with or without the helper.

| Id | Item | Command or file | Check that shows it took effect | Confirm |
|---|---|---|---|---|
| HOST-43 | A dedicated group whose only member is the service user | `sudo groupadd --system <helper-group>`, `sudo usermod -aG <helper-group> <service-user>` | `getent group <helper-group>` prints one line whose member list is exactly `<service-user>` | to confirm in 9A/H-05 |
| HOST-44 | The socket unit and the template service unit, owned by root; the socket active | the two unit files of the helper's delivery copied to `/etc/systemd/system/`, owner root, mode 0644; `sudo systemd-analyze verify` on both; `sudo systemctl daemon-reload`; `sudo systemctl enable --now` on the socket unit | `systemctl is-active` on the socket unit prints `active`; `stat -c '%U %G %a'` on the socket node prints `root <helper-group> 660`; `stat -c '%U %G %a'` on both unit files prints `root root 644` | to confirm in 9A/H-05 |
| HOST-45 | The helper file: owner root, group root, mode 0755, not a symbolic link, every parent directory root-owned | as the helper's installation procedure states | `namei -l` on the helper's path shows owner `root` and no `w` for group or others on every component, and no `l` type; `sha256sum` on it equals the hash the procedure prints | to confirm in 9A/H-05 |
| HOST-46 | The interface file: one line that names `<camera-interface>`, the one port on which the address helper adds its temporary address (the factory-address scan and the camera address change use it). Since R-FLEX it is not the port that limits the camera search or the camera connections. Owner root, mode 0644; it is not the port of the default route. The service user can read it: the running Core reads it itself before every `add`, with the fixed program `/usr/bin/cat /etc/dems/netalias-interface`, and a file it cannot read refuses every `add` | as the helper's installation procedure states; the folder `/etc/dems` as HOST-34 states (root, 0755); file G hides neither `/etc/dems` nor `/usr/bin/cat` from the service | `cat` on the file prints one line; `ip -4 route show default` names another interface; `stat -c '%U %a'` on the file prints `root 644`; `sudo -u <service-user> /usr/bin/cat /etc/dems/netalias-interface` prints the one line | to confirm in 9A/H-05 |
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

### 3.11 The two programs the Core starts for the commissioning functions

Added 2026-10-14 (decision C90). They are not items of their own: the item list stays HOST-01 to HOST-56, and the scripts of this profile do not print them. Both are needed only on a host that carries the address helper and uses the factory-address scan or the set-address job. The Core's start checks do not ask whether the two programs exist: a missing one is found at the first job, which is then refused. Nothing of this section was run on a host.

- **`/usr/sbin/ip`**, package `iproute2` (installed by HOST-18). The Core reads the kernel's neighbour table for ONE address with the fixed row `/usr/sbin/ip -4 neigh show to <a.b.c.d>`. It sends nothing and changes nothing; the address is the only argument that is not a literal, and no interface is named. Check, as the service user: `sudo -u <service-user> /usr/sbin/ip -4 neigh show to <an address a camera answers on>` prints one line `<address> dev <camera-interface> lladdr <six pairs>` followed by `REACHABLE`, `STALE`, `DELAY` or `PROBE` after the camera was spoken to; for a free address it prints a line that ends `FAILED`, or nothing. File G restricts no address family today; it must keep the netlink family for this read (to confirm in 9A/H-13: the line's form on Ubuntu 24.04, and that the read works from inside the Core's unit).
- **`/usr/bin/ping`**, package `iputils-ping` (`dpkg -S /usr/bin/ping` prints `iputils-ping: /usr/bin/ping`; install it with `sudo apt-get install -y iputils-ping` if a minimal installation lacks it). The Core sends ONE echo request with the fixed row `/usr/bin/ping -n -q -c 1 -W 1 <a.b.c.d>`, to learn whether something answers at an address before a camera is moved there. **Its right to send from inside the Core's unit must hold with HOST-38 and HOST-39 in force**: the unit can gain no privilege and has no capability, so a `ping` that needs a file capability or a set-user-id bit gains nothing there and ends with exit code 2. The Core reads that as "not known" and refuses every set-address job, fail closed. What makes it work is the kernel's unprivileged echo socket: `sysctl -n net.ipv4.ping_group_range` must print a range that holds the service user's group (hypothesis, not read on a host: Ubuntu 24.04 prints `0 2147483647`). Check, as the service user under the unit's two settings: `sudo systemd-run --wait --pipe -p User=<service-user> -p NoNewPrivileges=yes -p CapabilityBoundingSet= -p AmbientCapabilities= /usr/bin/ping -n -q -c 1 -W 1 <an address that answers on the camera switch>` exits 0, and the same for a free address exits 1 (to confirm in 9A/H-14: both exit codes and the range; the `systemd-run` line itself was not run anywhere). The echo leaves by the route the kernel chooses, since no interface is an argument; with HOST-19 in force and the address inside the camera subnet, that is the camera port.
- **Not started by the Core: `/usr/bin/arping`** (HOST-18). It opens a packet socket, which the Core's unit cannot. The address-level duplicate check stays the helper's, as root, at every `add`. The Core's own "does this address answer" is one echo, then the neighbour table: a device that answers the address question and not the echo still counts as "in use", and an answer the Core cannot read refuses the address.

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
| 8 | Search answers pass the firewall with the rules of HOST-23, on the camera subnet, on the Wi-Fi network (D33 M-6) and from a factory subnet; answers on the other networks of the host are not admitted, and a typed address there is still answered | needs a real camera | 9A/H-12, 9A/H-13 |
| 9 | The loopback rule beside the firewall, and after a restart. Settled by a measurement in an Ubuntu 24.04 container (2026-10-13; decision C103): a process with the Core unit's identity, no capability and no new privileges CANNOT list the table `inet dems_loopback`; the kernel refuses the listing whether the table is there or not. So the Core's start check reads the state of the unit of file E and nothing else. STATED LIMIT: a table deleted while that unit stays `active` is not detected by the Core; only the administrator's `sudo nft list table inet dems_loopback` shows the table. Not built, a design question: a root-made fact of this profile through which the table's state could reach the Core | real kernel: the measurement was a container on a virtual machine's kernel | 9A/H-01, 9A/H-16 |
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
- The user's acceptance of digest authentication over an unencrypted camera network in production. The dedicated port, the dedicated switch and HOST-20 are the host's part of that condition for the cameras on the camera port. A camera the Core reaches on another network of the host (R-FLEX) is outside that part, and its acceptance is also a decision of the user. Operating rule (decision Q96-08 a and b of task 2026-10-21_bare_metal_bench): the cameras of an installation stay on the static camera port, and the room network or Wi-Fi is used to reach a camera only for tests; a camera that is reached outside the camera port has a static address or a DHCP reservation, so that its address cannot pass to another device. The limit, stated: off the camera port the Core sends a stored camera's credential digest over unencrypted transport to whatever device holds the stored address, and it does not check first that this device is the same camera. Such a check is not part of this profile; it is a follow-up outside this revision.

## 6. Removal

To take the profile's own changes away, as the user: stop and disable `dems-core.service` and `dems-loopback-rule.service`; remove files A to G and `/etc/dems/`; run `sudo systemctl daemon-reload`, `sudo ldconfig`, `sudo sysctl --system` and `sudo netplan apply`; delete the two firewall rules of HOST-23 by their numbers; unmask the four targets of HOST-29; remove `<service-user>` from the two groups. The helper is removed by its own procedure. `<data-dir>` holds evidence: it is not removed by any step of this document.
