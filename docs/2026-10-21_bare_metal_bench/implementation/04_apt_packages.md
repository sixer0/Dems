# Row 24: apt package set (HOST-10, -11, -18, nftables, alsa-utils, iputils-ping)

Date: 2026-10-22, host .73 (D30). Commands: masterplan/02_plan.md row 24 verbatim; detached unit `dems-host-build-row24`.

- Block P disk guard: root_used_pct=8; watchdog active; Wi-Fi fault lines 0.
- Simulation: remv_lines=0, banned_in_plan=0 (71 Inst lines).
- Exit file: `0`.
- Checks: `6`; `3`; `1` (HOST-11, no libavformat-dev); `iputils-arping: /usr/bin/arping`, `1`; `/usr/bin/arping`; `arping_md5_equal`; `0`; `root 755 /usr/sbin/ip`, `root 755 /usr/bin/arping` (HOST-18); `0` (dpkg --audit silent). Block E: docker_du_equal, backup_ok. All as expected.
