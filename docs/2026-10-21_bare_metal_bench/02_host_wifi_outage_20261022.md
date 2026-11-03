# Host .73 unreachable 2026-10-21 21:40 to 2026-10-22 16:00 - root cause

Investigated 2026-10-22 16:00-16:10 WIB over SSH after the user's reset. Read-only; nothing was changed on the host.

## Symptom
- From the Mac (192.168.0.14) on 2026-10-22 ~15:55: SSH timeout, ARP `(incomplete)` for 192.168.0.73, no SSH host on 192.168.0.0/24 with the .73 host key.
- The host had NOT crashed or slept: boot -1 ran 2026-10-20 16:21 to 2026-10-22 16:00:19 (`journalctl --list-boots`).

## Timeline (journalctl -b -1)
| Time (WIB) | Event |
|---|---|
| 10-21 19:21:59 | `r8169 enp4s0: Link is Down` (camera LAN lost carrier; back now, cams .101-.103 .117 answer on 554) - unrelated to the outage |
| 10-21 20:28:58 | `rtw88_8821ce 0000:03:00.0: AMD-Vi: Event logged [IO_PAGE_FAULT ...]` |
| 10-21 20:28:59 | `rtw88_8821ce ...: failed to get tx report from firmware` |
| 10-21 20:32:08 | NetworkManager state `CONNECTED_SITE` (connectivity check lost the internet) |
| 10-21 21:39:27 | dhcp4 renewal: `state changed no lease` |
| 10-21 21:40:13 | wlp3s0 `activated -> failed (ip-config-unavailable)`, deauth |
| 10-21 21:40 onward | 575 cycles of `authentication ... timed out` -> `ssid-not-found`; 0 successful reconnects |
| 10-22 15:59:26 | still failing (last attempt before reset) |
| 10-22 16:00:19 | `Power key pressed short` (user) |
| 10-22 16:00:51 | new boot; journald: `system.journal corrupted or uncleanly shut down`; Wi-Fi associated, .73 again |

## Root cause
The Realtek RTL8821CE Wi-Fi card (AzureWave 1a3b:304c, driver `rtw88_8821ce`) hit a DMA fault under the AMD IOMMU at 20:28:58. Its transmit path stopped ("failed to get tx report from firmware") and the driver did not recover. Frames stopped leaving the card: first the DHCP renewal failed (21:39), then every authentication attempt timed out. NetworkManager reports that as `ssid-not-found`, but the access point was up (the Mac stayed on the same LAN). Only a reboot reset the card.

Evidence that it is the card, not the AP: the fault lines are the first anomaly; there are 0 such lines in boots -3, -2 and 0, and 2 in boot -1; the failure persisted for 18 h through 575 retries; one reboot fixed it.

## Contributing factors
1. Wi-Fi is the only management path to the host (no wired admin link; enp4s0 is the isolated camera LAN), so one radio fault is a total loss of access.
2. Wi-Fi power saving is ON (`/etc/NetworkManager/conf.d/default-wifi-powersave-on.conf`: `wifi.powersave = 3`). There are no `rtw88` options in `/etc/modprobe.d/`. Hypothesis, not proven here: the rtw88 8821CE is widely reported to wedge with power save / PCIe ASPM / deep LPS enabled.
3. Nothing watches the link: NetworkManager retries forever with no driver reload.
4. The reset was unclean (journal corrupted), so the power key was likely held, not tapped. No data loss seen (the DEMS stack was already down, Docker removed).

## Proposed fixes (NOT applied: they need the user's go-ahead)
| # | Fix | Reversible |
|---|---|---|
| F1 | Wi-Fi power save off: drop-in `wifi.powersave = 2` in /etc/NetworkManager/conf.d/ | yes, delete the file |
| F2 | `/etc/modprobe.d/rtw88.conf`: `options rtw88_pci disable_aspm=1` and `options rtw88_core disable_lps_deep=1` (takes effect at the next reboot) | yes, delete the file |
| F3 | Watchdog timer: if the gateway has been unreachable for N minutes, reload `rtw88_8821ce` (modprobe -r / modprobe), then reboot as the last step | yes, disable the unit |
| F4 | Durable: a wired admin link (second NIC or USB-Ethernet on the office LAN), or a DHCP reservation for .73 | hardware / router |

Note for the bare-metal blueprint: row 36 (ufw over Wi-Fi with auto-revert) and the reboots in rows 47 and 71 assume Wi-Fi is reliable. F1-F3 should land before those rows.

## DEMS state on the host (2026-10-22 16:05)
- Docker/containerd not installed; node, psql, ffmpeg absent; nftables 1.0.9 present. No DEMS units, no listeners except resolved/cups on loopback. ufw inactive, ip_forward 0. Disk 5% used.
- Backups present: ~/dems-backup-20261021, ~/dems-change-backup-20261021.sql, the Docker install folder; bundles in ~.
- Same state as the pause point in status_tasks.md: bare-metal install not started.

## Desktop contents
- `DEMS-source/` snapshot: HEAD e05a1567, 32 changed paths (as copied 10-21).
- `DEMS-TEMUAN-20261021.md`: identical to the Mac copy (sha256 58b98699...).
- `HANDOFF-DEMS-BENCH.md`: the host copy is newer (17:41) than the Mac copy. It adds a "closing 17:40" section: Docker removed at 17:35 via apt, so the stack is down and no listeners remain. The volumes are still in /var/lib/docker and must not be purged before the data moves. The tunnel loop is stopped. The removal was done by this Claude Code workflow (01_backup_and_docker_removal.md), not by an unknown actor. The handoff's author did not know that.
- The Mac copy in docs/2026-10-21_bench_deploy_findings/ was not updated (that folder holds plaintext passwords and is git-excluded).

## Fixes applied 2026-10-22 16:05-16:10 (user: "Ya, terapkan F1-F3 di .73 ... lalu verifikasi")
| Fix | File on .73 | Verified after a clean reboot at 16:07 |
|---|---|---|
| F1 | /etc/NetworkManager/conf.d/zz-dems-wifi-powersave-off.conf (`wifi.powersave = 2`, sorts after the package's default-wifi-powersave-on.conf) | `NetworkManager --print-config`: wifi.powersave=2; `iwconfig wlp3s0`: Power Management:off |
| F2 | /etc/modprobe.d/rtw88-dems.conf (`rtw88_pci disable_aspm=1`, `rtw88_core disable_lps_deep=1`) | /sys/module/.../disable_aspm = Y, disable_lps_deep = Y; `lspci -vv -s 03:00.0` LnkCtl: ASPM Disabled |
| F3 | /usr/local/sbin/dems-wifi-watchdog + /etc/systemd/system/dems-wifi-watchdog.{service,timer} (enabled; boot+2 min, then every 1 min) | timer active, service Result=success; DRYRUN with gateway 192.0.2.1: reload at checks 5 and 10, reboot from 15 refused under 3600 s uptime and with the noreboot flag, reboot taken with the guard off; recovery clears the counter; journal tag `dems-wifi-watchdog` |

F3 rules: it pings the default gateway of wlp3s0 (3 tries, 2 s). After 5 failed minutes it reloads `rtw88_8821ce`, again at 10, and reboots from 15 minutes on. It never reboots within 1 h of boot (so at most one reboot an hour while the router itself is down), nor while `/etc/dems-wifi-watchdog.noreboot` exists. **When DEMS runs on this host, create that flag or revisit the rule: a reboot during a recording would cut the session.**

Rollback: delete the three file groups, `systemctl disable --now dems-wifi-watchdog.timer`, `daemon-reload`, reboot.
