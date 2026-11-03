# Row 47 (HIL confirm): reboot before PREP-08

Date: 2026-10-22, host .73. User's word: D34 (3) "Ya, reboot jika G1 lolos" and D35; G1 re-issued PASS after D37.
PREPARE: `root:root 644`, `yes`, `0`, `inactive`, `disabled`, `Status: active`, `0` (boot before: 2026-10-22 16:07:39).
`sudo -n systemctl reboot` at 22:43:13; first SSH attempt 180 s later succeeded (no retry needed).
VERIFY: boot time `2026-10-22 22:43:28`; forwarding `0` `0` `0`; NTP `yes`; time-sync.target, ufw.service, dems-loopback-rule.service, postgresql@18-main.service, dems-console.service, dems-wifi-watchdog.timer all `active`; `Status: active`; dems-core `inactive`.
Block P: wifi_fault_lines=0, watchdog_actions_15min=0, watchdog_timer=active, flag=root:root 644, ntp=yes, root_used_pct=8. Also after boot: core_pattern `|/bin/false` (row 33 holds), postgres shell `/usr/sbin/nologin` and the cluster started (D37 holds). Listeners: 22 (sshd, all interfaces), 127.0.0.1:4432, 127.0.0.1:5173, CUPS 631 and resolver 53 on loopback only.
