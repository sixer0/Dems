# Row 36 (HIL confirm): firewall

Date: 2026-10-22, host .73. User's yes (D35): "Ya, aktifkan ufw sesuai row 36 (auto-revert 5 menit), lalu lanjut G1, reboot, dan boot SIMULATED sampai G2." Rules as shown to the user in the D34 question.

R0 (I-12, I-10): sshd `port 22`, listenaddress `[::]:22` and `0.0.0.0:22`, permitrootlogin `without-password`, passwordauthentication `yes`, gatewayports `no`, allowtcpforwarding `yes`; `Status: inactive`; user rules ALREADY PRESENT: `ufw allow 22/tcp`, `ufw allow OpenSSH` (runbook STOP); `IPV6=yes`, `DEFAULT_FORWARD_POLICY="DROP"`; built-in accepts at before.rules lines 37 43 68 72 (recorded, not a breach); wlp3s0 192.168.0.73/24, enp4s0 192.168.100.254/24; watchdog `active`.
Controller error: R1-R4 were staged in the same block as R0, before the STOP was read (ufw inactive, nothing in force). User ruling D36: "Biarkan" - the two old rules stay.
R1-R4: SSH 22/tcp on wlp3s0; defaults deny incoming / allow outgoing / deny routed; udp sport 3702 on enp4s0 and on wlp3s0 (D33 M-6).
R5-R6: preconditions `22`, `1`, `0`; timer `dems-ufw-revert` armed (`1`); `Status: active`; `Default: deny (incoming), allow (outgoing), disabled (routed)` - ufw prints "disabled" for routed while kernel forwarding is off (`net.ipv4.ip_forward` 0, row 33; `/etc/ufw/sysctl.conf` leaves ip_forward commented); DEFAULT_FORWARD_POLICY stays DROP.
R7 (fresh session, no multiplexing): `Status: active`, timer `active`.
R8: timer `inactive`; `Status: active`; 3702 rules `4` (IPv6 twins), `2` on enp4s0, `2` on wlp3s0 (E-15 as changed by D33, doubled for IPV6=yes).
Numbered rules: [1] 22/tcp, [2] OpenSSH, [3] 22/tcp on wlp3s0, [4] 3702/udp on enp4s0, [5] 3702/udp on wlp3s0, [6]-[10] their v6 twins.
Deviation from SEC §2.2 R4: rules [1], [2] (and v6 [6], [7]) admit SSH on every interface incl. the camera port (D36).
Files: /etc/ufw/ufw.conf (ENABLED=yes), user.rules, user6.rules, /etc/default/ufw, via ufw.
