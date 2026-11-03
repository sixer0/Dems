---
task_id: bare_metal_bench row 6 (source Q8)
date: 2026-10-22
agent: explore
scope: read-only survey of gsp-dems@192.168.0.73 (hostname gsp-dems-A520I-AC)
---

# Host survey .73 (Q8), 2026-10-22 16:15 WIB

Method: two SSH sessions (`ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -o BatchMode=yes gsp-dems@192.168.0.73 'bash -s' < script`). Only read commands; `sudo -n` used only for `ufw status`, `iptables -S`, `nft list ruleset`, `ls`. No secret printed (NM profiles listed by name/UUID/method only). Host up 7 min after the 16:00 reset (`uptime`: `16:15:14 up 7 min, load average: 0.00`). Tier 2.

Present host state taken from, not re-derived: `02_host_wifi_outage_20261022.md` (root cause) and `03_deployment_check_20261022.md` (Docker leftovers, mic, missing prerequisites). Files from the Wi-Fi fix F1-F3 are confirmed present below (section 12).

## Answers to Q8 at a glance
| Item | Answer |
|---|---|
| OS / kernel | Ubuntu 24.04.1 LTS noble, kernel 7.0.0-38-generic x86_64 |
| Lid | No lid on this machine (desktop board A520I-AC); logind lid/power left at compile-time defaults (no drop-in), sleep/suspend/hibernate/hybrid-sleep targets masked |
| Disk | One NVMe Micron 2400 512 GB, `/` = nvme0n1p2 ext4 469G, 5% used; no separate /var, /home, /opt, no EFI partition listed (p1 is 1M, no fs) |
| RAM / swap | 15.0 GiB RAM (MemTotal 15718624 kB), 4 GiB swapfile /swap.img |
| CPU | AMD Ryzen 5 5600G, 6 cores / 12 threads |
| Time | `System clock synchronized: yes`, systemd-timesyncd active, ntp.ubuntu.com stratum 2; Asia/Jakarta (WIB +0700); RTC in UTC |
| Users | only gsp-dems (uid 1000) plus system users; NO dems* user or group; audio group is empty |
| Firewall | ufw installed, service active but `Status: inactive` (ENABLED=no); iptables, ip6tables, nat all ACCEPT with 0 rules; nft ruleset empty (0 lines) |
| Packages missing | node, npm, ffmpeg/ffprobe, postgresql*, libpq-dev, build-essential/gcc/g++/make, pkg-config, nasm, yasm, iputils-arping, expect |
| Packages present | git 2.43.0, nftables 1.0.9, python3 3.12.3, curl 8.5.0, ca-certificates, gnupg 2.4.4, alsa-utils 1.2.9, openssh-server, ufw 0.36.2, libx264-164 |

## 1. OS and kernel
```
$ cat /etc/os-release | head -4; uname -a
PRETTY_NAME="Ubuntu 24.04.1 LTS"  NAME="Ubuntu"  VERSION_ID="24.04"  VERSION="24.04.1 LTS (Noble Numbat)"
Linux gsp-dems-A520I-AC 7.0.0-38-generic #38~24.04.4-Ubuntu SMP PREEMPT_DYNAMIC Mon Sep 14 16:37:11 UTC 2 x86_64 x86_64 x86_64 GNU/Linux
```

## 2. Lid and power behaviour
```
$ grep -rHE "^\s*(Handle|Lid|Idle|Suspend)" /etc/systemd/logind.conf /etc/systemd/logind.conf.d/ /usr/lib/systemd/logind.conf.d/ ; ls /etc/systemd/logind.conf.d/
(no active setting lines)   ls: cannot access '/etc/systemd/logind.conf.d/': No such file or directory
$ systemd-analyze cat-config systemd/logind.conf     -> only the stock /etc/systemd/logind.conf, every key still commented (#NAutoVTs=6 ...)
$ ls /proc/acpi/button/      -> No such file or directory   (no lid or button ACPI nodes)
$ upower -d | grep -i lid    -> lid-is-closed: no   lid-is-present: no
$ busctl get-property org.freedesktop.login1 /org/freedesktop/login1 org.freedesktop.login1.Manager HandleLidSwitch HandlePowerKey HandleSuspendKey
s "suspend"
s "poweroff"
s "suspend"
```
Reading: effective logind defaults are HandleLidSwitch=suspend, HandlePowerKey=poweroff, HandleSuspendKey=suspend, but there is no lid (`lid-is-present: no`), so no lid event can occur. Suspend would still fire from a suspend key or idle if the targets were not masked; they are:
```
$ systemctl is-enabled sleep.target suspend.target hibernate.target hybrid-sleep.target
masked masked masked masked
$ ls -l /etc/systemd/system | grep -E "sleep|suspend|hibern"
sleep.target -> /dev/null, suspend.target -> /dev/null, hibernate.target -> /dev/null, hybrid-sleep.target -> /dev/null   (all dated Oct 20 08:54)
$ ls /etc/systemd/sleep.conf.d/   -> No such file or directory
```
`suspend-then-hibernate.target` is `static` (not masked; the blueprint's 4-target list in row 38 covers sleep, suspend, hibernate, hybrid-sleep, which are all masked already). Consequence for row 38: HOST-29..HOST-32 sleep items are already satisfied; "file F only if a lid is found" does not apply (no lid found). Power key short press = poweroff by default (the 10-22 16:00 reset in 02_ used it).

## 3. Disks, partitions, filesystems, mount options
```
$ lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS,MODEL,ROTA   (loop0-12 are snap squashfs, omitted)
nvme0n1      476.9G disk              Micron_2400_MTFDKBA512QFM  ROTA 0
├─nvme0n1p1     1M  part
└─nvme0n1p2 476.9G  part ext4   /
$ df -hT -x tmpfs -x devtmpfs
/dev/nvme0n1p2 ext4  469G   20G  426G   5% /
$ findmnt --real -o TARGET,SOURCE,FSTYPE,OPTIONS   (first line)
/   /dev/nvme0n1p2   ext4   rw,relatime      (plus snap squashfs loops ro, and /run/user/1000/doc fuse.portal)
$ grep -v "^#" /etc/fstab
/dev/disk/by-uuid/743c4635-01da-4fa2-bb48-36ca47f61191 / ext4 defaults 0 1
/swap.img	none	swap	sw	0	0
```
One filesystem holds everything (no separate /var/lib or /home), no noatime/discard option set; nothing that blocks a data directory under /var/lib or /opt. Snap is in use (firefox, snapd etc.).

## 4. RAM, swap, CPU
```
$ free -h
Mem: 14Gi total, 1.2Gi used, 13Gi free, 13Gi available     Swap: 4.0Gi 0B used
$ swapon --show        /swap.img file 4G
$ grep -E "MemTotal|SwapTotal" /proc/meminfo     MemTotal: 15718624 kB   SwapTotal: 4194300 kB
$ lscpu     Architecture x86_64; CPU(s) 12; Model name AMD Ryzen 5 5600G with Radeon Graphics; Thread(s) per core 2; Core(s) per socket 6; Socket(s) 1
```

## 5. Time and NTP
```
$ timedatectl
Local time: Thu 2026-10-22 16:15:14 WIB   Universal time: 09:15:14 UTC   RTC time: 09:15:14
Time zone: Asia/Jakarta (WIB, +0700)   System clock synchronized: yes   NTP service: active   RTC in local TZ: no
$ timedatectl show-timesync     ServerName=ntp.ubuntu.com  Stratum=2  RootDelay=46.417ms  Jitter=4.131ms  PollIntervalMaxUSec=34min 8s  PacketCount=4
$ systemctl is-active systemd-timesyncd chrony ntp systemd-time-wait-sync    active inactive inactive inactive
$ systemctl is-enabled systemd-time-wait-sync    disabled
```
Time sync is by systemd-timesyncd against ntp.ubuntu.com over the Wi-Fi uplink. `systemd-time-wait-sync` is disabled (row 38 expects it enabled). The camera LAN has no uplink; timesyncd depends on the Wi-Fi default route. chrony package state `un` (not installed).

## 6. Users and groups
```
$ getent passwd | awk -F: '$3>=1000 || /dems/'
nobody:65534:65534:/nonexistent:/usr/sbin/nologin
gsp-dems:1000:1000:/home/gsp-dems:/bin/bash          (GECOS "GSP - DEMS")
$ id    uid=1000(gsp-dems) gid=1000(gsp-dems) groups=1000(gsp-dems),4(adm),20(dialout),24(cdrom),27(sudo),30(dip),46(plugdev),100(users),114(lpadmin),984(docker)
$ getent group audio dialout video plugdev sudo docker
audio:x:29:        dialout:x:20:gsp-dems   video:x:44:   plugdev:x:46:gsp-dems   sudo:x:27:gsp-dems   docker:x:984:gsp-dems
$ getent group | grep -i dems     gsp-dems:x:1000:     (only the primary group of the login user)
$ getent passwd | grep -i dems    gsp-dems only
```
No dems-core user or group, no helper group. The `docker` group (gid 984) still exists with gsp-dems as member although docker-ce is removed (config-only `rc`, see 03_ HOST-21). The `audio` group has no members: gsp-dems is not in it; a nologin service user reading /dev/snd needs `audio` (devices `/dev/snd/pcmC*D*c`).

## 7. APT sources
```
$ ls -l /etc/apt/sources.list /etc/apt/sources.list.d/ /etc/apt/keyrings/ /etc/apt/trusted.gpg.d/
sources.list (70 B, comment only: no active line)
sources.list.d/: docker.sources (Oct 19 17:36), ubuntu.sources (Oct 19 13:16), ubuntu.sources.curtin.orig (Aug 27 2024)
keyrings/: docker.asc      trusted.gpg.d/: ubuntu-keyring-2012-cdimage.gpg, ubuntu-keyring-2018-archive.gpg
$ active lines of ubuntu.sources
URIs: http://id.archive.ubuntu.com/ubuntu/  Suites: noble noble-updates noble-backports  Components: main restricted universe multiverse  Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
URIs: http://security.ubuntu.com/ubuntu/    Suites: noble-security                       Components: main restricted universe multiverse
$ docker.sources     Types: deb  URIs: https://download.docker.com/linux/ubuntu  Suites: noble  Components: stable  Architectures: amd64  Signed-By: /etc/apt/keyrings/docker.asc
```
`ubuntu.sources.curtin.orig` is not a `.sources` suffix, so apt ignores it. Docker source is still configured though docker-ce is removed. No PGDG (apt.postgresql.org) or NodeSource source: row 12/PG18 and Node 26 need those added or the archive route (rows 8-10).

## 8. Firewall
```
$ sudo -n ufw status verbose        Status: inactive
$ systemctl is-active ufw; is-enabled ufw      active / enabled        $ grep ^ENABLED /etc/ufw/ufw.conf   ENABLED=no
$ sudo -n iptables -S      -P INPUT ACCEPT  -P FORWARD ACCEPT  -P OUTPUT ACCEPT      (no rules)
$ sudo -n ip6tables -S     same three ACCEPT policies, no rules
$ sudo -n iptables -t nat -S   -P PREROUTING/INPUT/OUTPUT/POSTROUTING ACCEPT, no rules
$ sudo -n nft list ruleset | wc -l     0
```
No Docker chains left (matches 03_ "iptables now 0 rules after reboot"). nftables package installed; no `dems-loopback-rule.service` exists.

## 9. NetworkManager profiles (names, devices, autoconnect; no PSK read)
```
$ nmcli -t -f NAME,UUID,TYPE,DEVICE,AUTOCONNECT,AUTOCONNECT-PRIORITY connection show
GSP 01 5G : a4ba95d4-8f92-4880-9f72-54a3f552acd5 : 802-11-wireless : wlp3s0 : yes : 0
DEMS Camera LAN : 5aa09499-38a2-4d33-8f6a-0fadf23fb16c : 802-3-ethernet : enp4s0 : yes : 0
lo : cbf0bdc9-... : loopback : lo : no : 0
$ nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status   wlp3s0 wifi connected "GSP 01 5G"; enp4s0 ethernet connected "DEMS Camera LAN"; lo loopback connected (externally)
$ nmcli ... connection show <uuid> (selected fields)
GSP 01 5G:        interface wlp3s0, autoconnect yes, ipv4 auto, ipv6 auto, 802-11-wireless.powersave default (0)
DEMS Camera LAN:  interface enp4s0, autoconnect yes, ipv4 manual 192.168.100.254/24, no gateway, ipv4.never-default yes, ipv6 ignore
$ ip -br addr / ip route
enp4s0 UP 192.168.100.254/24     wlp3s0 UP 192.168.0.73/24
default via 192.168.0.1 dev wlp3s0 proto dhcp metric 600; 192.168.0.0/24 dev wlp3s0; 192.168.100.0/24 dev enp4s0 metric 100
$ ls -l /etc/NetworkManager/system-connections/   dems-camera-lan.nmconnection (root 0600, Oct 21 16:27)   [the Wi-Fi profile is held via netplan]
$ ls -l /etc/netplan/   01-network-manager-all.yaml (0644), 50-cloud-init.yaml (0600), 90-NM-a4ba95d4-...yaml (0600)
```
Note: a PSK-bearing profile (GSP 01 5G) is netplan-managed (`90-NM-<uuid>.yaml`, 0600); not opened. Camera LAN has no gateway and never-default, so the Wi-Fi remains the only default route and the only admin path (02_ contributing factor 1).

## 10. Package inventory
```
$ dpkg-query -W ... (status abbrev ii = installed, un = unknown/not installed)
ii alsa-utils 1.2.9-1ubuntu5      ii ca-certificates 20260816ubuntu0.24.04.1   ii curl 8.5.0-2ubuntu10.16
ii git 1:2.43.0-1ubuntu7.4        ii gnupg 2.4.4-2ubuntu17.6                   ii libx264-164 2:0.164.3108+git31e19f9-1
ii nftables 1.0.9-1build1         ii openssh-server 1:9.6p1-3ubuntu13.20       ii python3 3.12.3-0ubuntu2.1    ii ufw 0.36.2-6
un chrony, un gcc, un make, un postgresql-pgmp
"no packages found": node*, nodejs, npm, ffmpeg, libpq-dev, build-essential, g++, pkg-config, nasm, yasm, iputils-arping, expect, ntpsec; postgresql* matched only the unknown stub postgresql-pgmp
$ command -v ...   node absent, npm absent, ffmpeg absent, ffprobe absent, psql absent, gcc absent, make absent, pkg-config absent,
                   nasm absent, yasm absent, arping absent, expect absent, pg_config absent;
                   present: nft /usr/sbin/nft, git /usr/bin/git, arecord /usr/bin/arecord, curl /usr/bin/curl, python3 /usr/bin/python3
```
Agrees with 03_ finding D4. Note: Ubuntu already carries libx264-164 as a runtime library only (no -dev), which does not help an FFmpeg source build.

## 11. Audio capture devices
```
$ arecord -l
card 1: AUDIO [BOMGE USB AUDIO], device 0: USB Audio [USB Audio]
card 2: Generic_1 [HD-Audio Generic], device 0: ALC897 Analog      and device 2: ALC897 Alt Analog
$ cat /proc/asound/cards
0 [Generic] HDA-Intel (HDMI, no capture)    1 [AUDIO] USB-Audio - BOMGE USB AUDIO, "HANMUS BOMGE USB AUDIO at usb-0000:01:00.0-1, high speed"    2 [Generic_1] HDA-Intel (ALC897, 3 capture pcm)
$ ls /dev/snd    pcmC1D0c pcmC2D0c pcmC2D2c (capture), controlC0-2, by-id, by-path
```
Matches 03_ D2/D3 (USB mic card 1, ALC897 card 2). Capture nodes are owned per the audio group (not checked beyond listing); audio group has no members.

## 12. Sudoers drop-ins and Wi-Fi fix state
```
$ sudo -n ls /etc/sudoers.d/     90-gsp-dems   README        (90-gsp-dems 0440, 33 B, Oct 20 08:54; contents not printed)
$ sudo -n -l   (ALL : ALL) ALL ; (ALL) NOPASSWD: ALL
```
Wi-Fi fix files (from 02_, present host state; not touched):
```
$ ls -l /etc/NetworkManager/conf.d/ /etc/modprobe.d/rtw88-dems.conf
default-wifi-powersave-on.conf (32 B, Apr 5 2024: wifi.powersave = 3)    zz-dems-wifi-powersave-off.conf (278 B, Oct 22 16:05: wifi.powersave = 2)
/etc/modprobe.d/rtw88-dems.conf (206 B, Oct 22 16:05): options rtw88_pci disable_aspm=1 ; options rtw88_core disable_lps_deep=1
$ systemctl list-timers dems-wifi-watchdog.timer    NEXT 16:15:56 WIB, LAST 16:14:56 WIB, activates dems-wifi-watchdog.service
$ systemctl is-enabled dems-wifi-watchdog.timer     enabled
$ systemctl --failed     0 loaded units listed
```
Caveat: the per-connection value reads `default` for GSP 01 5G, so the effective power-save setting comes from the `zz-` drop-in (value 2 = disable). Whether the rtw88 module options are active was not queried (they apply at the module load; the host rebooted at 16:00 and the files are dated 16:05, so they take effect only at the NEXT reboot, per the file text and 02_ F2).

## Gaps / unknowns
- Whether the modprobe options are live: files written 16:05, host booted 16:00, so the options are probably not yet active (`/sys/module/rtw88_pci/parameters/disable_aspm` not read; one more read-only check would settle it).
- Contents of /etc/sudoers.d/90-gsp-dems not read (33 B, matches the NOPASSWD ALL line shown by `sudo -l`).
- `systemd-time-wait-sync` is disabled; timesyncd depends on the Wi-Fi uplink.
- 1 MB nvme0n1p1 has no filesystem and there is no ESP in lsblk: boot mode (BIOS/GRUB-bios vs UEFI) not checked; relevant only for a reinstall.
- logind keys read via busctl only for the three Handle* properties; IdleAction not queried.

*Generated: 2026-10-22*
